'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SiteNav, SiteFooter } from '@/components/SiteChrome'
import { IconArrow, IconShield, IconLegal } from '@/components/icons'

const YEARS = [
  { v: 2024, label: '2024 입학 · 현 고3', sys: '2027 구체제' },
  { v: 2025, label: '2025 입학 · 현 고2', sys: '2028 신체제' },
  { v: 2026, label: '2026 입학 · 현 고1', sys: '2028 신체제' },
]
const TRACKS: { v: string; label: string }[] = [
  { v: 'humanities', label: '인문' },
  { v: 'social', label: '사회' },
  { v: 'natural', label: '자연' },
  { v: 'engineering', label: '공학' },
  { v: 'arts_athletics', label: '예체능' },
]
const REGIONS: { v: string; label: string }[] = [
  { v: 'metro', label: '수도권' },
  { v: 'non_metro', label: '비수도권' },
  { v: 'unknown', label: '미정' },
]
const GRADES = [1, 2, 3]

export default function IntakePage() {
  const router = useRouter()
  const [saengbu, setSaengbu] = useState('')
  // 종단 트윈(학기 비교) — 옵션. priorSaengbu가 비어 있으면 단일 학기 경로(기존과 동일).
  const [compare, setCompare] = useState(false)
  const [priorSaengbu, setPriorSaengbu] = useState('')
  const [priorTerm, setPriorTerm] = useState('이전 학기')
  const [currentTerm, setCurrentTerm] = useState('이번 학기')
  const [admissionYear, setYear] = useState(2025)
  const [track5, setTrack] = useState('social')
  const [targetRegion, setRegion] = useState('metro')
  const [grade, setGrade] = useState(2)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // a11y: which control failed validation, for aria-invalid / focus
  const [invalid, setInvalid] = useState<'saengbu' | 'consent' | null>(null)
  const saengbuRef = useRef<HTMLTextAreaElement>(null)
  const consentRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  // remember focus before the modal opened, to restore on close/error
  const lastFocus = useRef<HTMLElement | null>(null)

  // Move focus to the offending field when validation fails.
  useEffect(() => {
    if (invalid === 'saengbu') saengbuRef.current?.focus()
    else if (invalid === 'consent') consentRef.current?.focus()
  }, [invalid])

  // Modal focus management: move focus into the dialog while busy,
  // restore to the trigger when it closes (success navigates away; error returns).
  useEffect(() => {
    if (busy) {
      lastFocus.current = (document.activeElement as HTMLElement) ?? null
      dialogRef.current?.focus()
    } else if (lastFocus.current) {
      lastFocus.current.focus()
      lastFocus.current = null
    }
  }, [busy])

  async function submit() {
    setError('')
    setInvalid(null)
    if (!consent) {
      setError('민감정보(생기부) 처리에 동의해야 진단을 진행할 수 있습니다.')
      setInvalid('consent')
      return
    }
    if (!saengbu.trim()) {
      setError('생기부 내용을 붙여넣어 주세요.')
      setInvalid('saengbu')
      return
    }
    setBusy(true)
    // 학기 비교는 prior 생기부가 채워졌을 때만 보낸다 → 비어 있으면 단일 학기(기존과 동일).
    const compareOn = compare && priorSaengbu.trim().length > 0
    const body = {
      admissionYear,
      track5,
      targetRegion,
      schoolType: 'general',
      grade,
      saengbu,
      consent: { sensitive: true, guardian: false },
      ...(compareOn
        ? {
            priorSaengbu,
            priorTerm: priorTerm.trim() || '이전 학기',
            currentTerm: currentTerm.trim() || '이번 학기',
          }
        : {}),
    }
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let msg = '분석에 실패했습니다. 잠시 후 다시 시도해 주세요.'
        try {
          const j = await res.json()
          if (j?.error) msg = j.error
        } catch {
          /* non-JSON */
        }
        setError(msg)
        setBusy(false)
        return
      }
      sessionStorage.setItem('coach:result', await res.text())
      router.push('/')
    } catch {
      setError('네트워크 오류로 분석하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  // 오버레이 카피용: 학기 비교가 켜졌으면 더 긴 처리(LLM 호출 증가)를 안내.
  const comparing = compare && priorSaengbu.trim().length > 0

  return (
    <>
      {/* processing overlay — modal status dialog (kept outside the inert tree) */}
      {busy && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-[200] grid place-items-center px-6 outline-none"
          style={{ background: 'rgba(13,26,31,.55)', backdropFilter: 'blur(6px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="busy-title"
          aria-describedby="busy-desc"
          tabIndex={-1}
        >
          <div className="card w-full max-w-[420px] p-8 text-center" role="status" aria-live="polite">
            <div className="mx-auto mb-4 grid place-items-center">
              <svg viewBox="0 0 200 200" fill="none" className="ring-spin h-20 w-20" aria-hidden focusable={false}>
                <circle cx="100" cy="100" r="86" stroke="var(--pullim-line)" strokeWidth="6" />
                <circle
                  cx="100"
                  cy="100"
                  r="86"
                  stroke="var(--pullim-blue)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="135 405"
                  transform="rotate(-90 100 100)"
                />
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--pullim-blue)' }}>
              분석 중
            </div>
            <p id="busy-title" className="mt-1" style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>
              {comparing ? '두 학기 생기부를 비교 분석하는 중…' : '생기부를 분석하는 중…'}
            </p>
            <p id="busy-desc" className="mt-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
              식별정보를 마스킹하고 코호트 규칙으로 합법 액션을 산출합니다.
              {comparing && ' 두 학기를 대조하느라 평소보다 시간이 더 걸립니다.'} 결과는 저장하지 않고 처리 후 즉시 폐기합니다.
            </p>
          </div>
        </div>
      )}

      {/* Background made inert while the modal is open so AT and the keyboard
          cannot reach controls behind the overlay; focus is trapped to the dialog. */}
      <div inert={busy || undefined}>
      <SiteNav cta={<span />} />

      <main id="main" className="container-x py-12">
        <span className="eyebrow">시작하기</span>
        <h1
          className="mt-4"
          style={{ fontFamily: 'var(--f-brand)', fontSize: 'clamp(26px,3.4vw,38px)', fontWeight: 700, letterSpacing: 'var(--ls-display)' }}
        >
          생기부를 넣고, 코호트를 고르면 끝.
        </h1>
        <p className="mt-3 max-w-[640px]" style={{ fontSize: 'var(--fs-base)', color: 'var(--fg-muted)' }}>
          민감정보인 생기부는 식별정보를 자동 마스킹한 뒤 분석합니다. 결과는 저장하지 않고 처리 후
          즉시 폐기합니다.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* left: inputs */}
          <div className="card" style={{ padding: 24 }}>
            <div className="mb-4">
              <label htmlFor="saengbu" className="field-label">
                생기부 붙여넣기{' '}
                <span style={{ color: 'var(--pullim-ink4)', fontWeight: 500 }}>(식별정보 자동 마스킹)</span>
              </label>
              <textarea
                id="saengbu"
                ref={saengbuRef}
                className="control"
                style={{ height: 200, fontSize: 13, fontFamily: 'var(--f-mono)' }}
                value={saengbu}
                onChange={(e) => setSaengbu(e.target.value)}
                aria-invalid={invalid === 'saengbu' || undefined}
                aria-describedby={invalid === 'saengbu' ? 'intake-error' : undefined}
                placeholder="세특·창체·행특 등 생기부 텍스트를 붙여넣으세요. 이름·연락처·이메일 등 식별정보는 분석 전 자동으로 가립니다."
              />
            </div>

            {/* 종단 트윈(학기 비교) — 옵션 토글. 비어 있으면 단일 학기 경로로 동작. */}
            <fieldset className="mb-4 border-0 p-0 m-0">
              <legend className="sr-only">학기 비교 (선택)</legend>
              <label
                className="flex cursor-pointer items-start gap-3 px-4 py-3"
                style={{
                  border: `1.5px solid ${compare ? 'var(--pullim-blue)' : 'var(--hairline)'}`,
                  borderRadius: 'var(--r-md)',
                  background: compare ? 'var(--pb-1)' : 'var(--bg)',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--pullim-ink2)',
                  transition: 'border-color .15s ease, background .15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={(e) => setCompare(e.target.checked)}
                  aria-controls="prior-fields"
                  aria-expanded={compare}
                  className="mt-[2px] h-[18px] w-[18px] flex-none"
                  style={{ accentColor: 'var(--pullim-blue)' }}
                />
                <span>
                  <b>이전 학기 생기부도 넣기 (학기 비교)</b>
                  <span className="mt-[2px] block" style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)' }}>
                    지난 학기 처방이 이번 학기 생기부에 실제 반영됐는지 ③ 추적에서 대조합니다.
                  </span>
                </span>
              </label>

              {compare && (
                <div id="prior-fields" className="mt-3 flex flex-col gap-3">
                  <div>
                    <label htmlFor="prior-saengbu" className="field-label">
                      이전 학기 생기부 붙여넣기{' '}
                      <span style={{ color: 'var(--pullim-ink4)', fontWeight: 500 }}>(식별정보 자동 마스킹)</span>
                    </label>
                    <textarea
                      id="prior-saengbu"
                      className="control"
                      style={{ height: 160, fontSize: 13, fontFamily: 'var(--f-mono)' }}
                      value={priorSaengbu}
                      onChange={(e) => setPriorSaengbu(e.target.value)}
                      placeholder="이전 학기의 세특·창체·행특 텍스트를 붙여넣으세요. 식별정보는 이번 학기 생기부와 동일하게 분석 전 자동으로 가립니다."
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="prior-term" className="field-label">
                        이전 학기 이름
                      </label>
                      <input
                        id="prior-term"
                        type="text"
                        className="control"
                        value={priorTerm}
                        onChange={(e) => setPriorTerm(e.target.value)}
                        placeholder="이전 학기"
                      />
                    </div>
                    <div>
                      <label htmlFor="current-term" className="field-label">
                        이번 학기 이름
                      </label>
                      <input
                        id="current-term"
                        type="text"
                        className="control"
                        value={currentTerm}
                        onChange={(e) => setCurrentTerm(e.target.value)}
                        placeholder="이번 학기"
                      />
                    </div>
                  </div>
                  <p style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--pullim-ink4)' }}>
                    학기 비교는 두 학기를 대조하느라 분석에 시간이 더 걸립니다.
                  </p>
                </div>
              )}
            </fieldset>

            <fieldset className="grid grid-cols-1 gap-3 border-0 p-0 m-0 sm:grid-cols-2">
              <legend className="field-label mb-2 p-0">코호트 정보</legend>
              <div>
                <label htmlFor="year" className="field-label">
                  입학연도 (코호트)
                </label>
                <select
                  id="year"
                  className="control"
                  value={admissionYear}
                  onChange={(e) => setYear(+e.target.value)}
                >
                  {YEARS.map((y) => (
                    <option key={y.v} value={y.v}>
                      {y.label} · {y.sys}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="grade" className="field-label">
                  학년
                </label>
                <select
                  id="grade"
                  className="control"
                  value={grade}
                  onChange={(e) => setGrade(+e.target.value)}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      고{g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="track" className="field-label">
                  계열
                </label>
                <select
                  id="track"
                  className="control"
                  value={track5}
                  onChange={(e) => setTrack(e.target.value)}
                >
                  {TRACKS.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="region" className="field-label">
                  목표 권역
                </label>
                <select
                  id="region"
                  className="control"
                  value={targetRegion}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {REGIONS.map((r) => (
                    <option key={r.v} value={r.v}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>

            {error && (
              <p
                id="intake-error"
                className="mt-4 px-4 py-3"
                role="alert"
                style={{ borderRadius: 'var(--r-md)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}
              >
                {error}
              </p>
            )}
          </div>

          {/* right: consent + seal */}
          <div className="flex flex-col gap-4">
            <fieldset className="border-0 p-0 m-0">
              <legend className="field-label flex items-center gap-2 p-0">
                <IconLegal size={15} /> 법적 동의 (§23 민감정보)
              </legend>
              <label
                className="flex cursor-pointer items-start gap-3 px-4 py-[14px]"
                style={{
                  border: `1.5px solid ${consent ? 'var(--pullim-blue)' : 'var(--hairline)'}`,
                  borderRadius: 'var(--r-md)',
                  background: consent ? 'var(--pb-1)' : 'rgba(3,98,218,.04)',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--pullim-ink2)',
                  transition: 'border-color .15s ease, background .15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  ref={consentRef}
                  required
                  className="mt-[2px] h-[18px] w-[18px] flex-none"
                  style={{ accentColor: 'var(--pullim-blue)' }}
                  aria-invalid={invalid === 'consent' || undefined}
                  aria-describedby={invalid === 'consent' ? 'consent-text intake-error' : 'consent-text'}
                />
                <span id="consent-text">
                  <b>[필수]</b> 생기부는 민감정보입니다. 진단 목적의 처리에 동의하며, 결과가{' '}
                  <b>저장되지 않고 처리 후 즉시 폐기</b>됨을 확인합니다. (AI 학습에 사용하지 않음)
                </span>
              </label>
            </fieldset>

            <div
              className="card p-4 text-center"
              style={{ background: 'radial-gradient(120% 120% at 50% 0,rgba(230,255,76,.22),#fff)' }}
            >
              <span className="sg brand mx-auto mb-2">
                <IconShield size={18} />
              </span>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--pullim-blue)' }}>
                설계된 신뢰
              </div>
              <div className="my-1" style={{ fontSize: 'var(--fs-base)', fontWeight: 700 }}>데이터 미학습 · 즉시삭제</div>
              <small style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)' }}>
                모든 처방은 생기부 원문을 인용하고, 불확실성을 함께 표기합니다.
              </small>
            </div>

            <button
              ref={submitRef}
              onClick={submit}
              disabled={busy || !consent}
              aria-describedby="submit-hint submit-note"
              className="btn-primary w-full justify-center"
            >
              {busy ? (
                <>
                  <span className="spinner" aria-hidden /> 분석 중…
                </>
              ) : (
                <>
                  진단 시작 <IconArrow size={16} />
                </>
              )}
            </button>
            {!consent && !busy && (
              <p id="submit-hint" className="text-center" style={{ fontSize: 'var(--fs-xs)', color: 'var(--bad)', fontWeight: 600 }}>
                §23 민감정보 처리에 동의하면 진단을 시작할 수 있습니다.
              </p>
            )}
            <p id="submit-note" className="text-center" style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)' }}>
              제안은 모두 학생 본인이 앞으로 할 활동이며, 교사 기재영역을 대신 작성하지 않습니다.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
      </div>
    </>
  )
}
