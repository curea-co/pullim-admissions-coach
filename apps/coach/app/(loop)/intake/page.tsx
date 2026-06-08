'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function IntakePage() {
  const router = useRouter()
  const [saengbu, setSaengbu] = useState('')
  const [admissionYear, setYear] = useState(2025)
  const [track5, setTrack] = useState('natural')
  const [targetRegion, setRegion] = useState('metro')
  const [grade, setGrade] = useState(2)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (!consent) { setError('민감정보(생기부) 처리에 동의해야 진행할 수 있습니다.'); return }
    if (!saengbu.trim()) { setError('생기부 내용을 입력하세요.'); return }
    setBusy(true)
    const body = { admissionYear, track5, targetRegion, schoolType: 'general', grade, saengbu, consent: { sensitive: true, guardian: false } }
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setBusy(false)
    if (!res.ok) { setError((await res.json()).error ?? '분석 실패'); return }
    sessionStorage.setItem('coach:result', await res.text())
    router.push('/')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">생기부 실행 루프 시작</h1>
      <label className="block text-sm">입학연도(코호트)
        <select className="mt-1 block w-full rounded border p-2" value={admissionYear} onChange={e => setYear(+e.target.value)}>
          <option value={2024}>2024 (현 고3·구체제)</option>
          <option value={2025}>2025 (현 고2·신체제)</option>
          <option value={2026}>2026 (현 고1·신체제)</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">계열
          <select className="mt-1 block w-full rounded border p-2" value={track5} onChange={e => setTrack(e.target.value)}>
            {['humanities','social','natural','engineering','arts_athletics'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-sm">목표 권역
          <select className="mt-1 block w-full rounded border p-2" value={targetRegion} onChange={e => setRegion(e.target.value)}>
            <option value="metro">수도권</option><option value="non_metro">비수도권</option><option value="unknown">미정</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">생기부 내용(붙여넣기)
        <textarea className="mt-1 block h-48 w-full rounded border p-2" value={saengbu} onChange={e => setSaengbu(e.target.value)} placeholder="세특·창체 등 생기부 텍스트" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
        <span>[필수] 생기부는 민감정보입니다. 진단 목적 처리에 동의하며, 분석 결과는 저장되지 않고 처리 후 즉시 폐기됨을 확인합니다. (무학습·즉시삭제)</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={busy} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? '분석 중…' : '진단 시작'}
      </button>
    </div>
  )
}
