import type { ReactNode } from 'react'
import type { TwinDiff } from '@pullim/engine'
import type { AnalyzeResult } from '@/lib/analyze'
import { IconDiagnose, IconPrescribe, IconTrack, IconProve, IconCheck } from './icons'

const AREA_LABEL: Record<string, string> = {
  SETUK: '세특',
  CREATIVE_REGULAR: '정규 창체',
  BEHAVIOR: '행특',
}
const COMP_LABEL: Record<string, string> = {
  ACADEMIC: '학업역량',
  CAREER: '진로역량',
  COMMUNITY: '공동체역량',
}
const SYS_LABEL: Record<string, string> = {
  '2027_old': '2027 구체제',
  '2028_new': '2028 신체제',
  '2029_new': '2029 신체제',
}
const REGION_LABEL: Record<string, string> = {
  metro: '수도권 · 수시 65 : 정시 35',
  non_metro: '비수도권 · 수시 우위',
  unknown: '권역 미정',
}

function StageHead({ n, title, meta, icon }: { n: string; title: string; meta: string; icon: ReactNode }) {
  return (
    <div className="mb-4 mt-9 flex flex-wrap items-center gap-[14px]">
      <span className="sg brand">{icon}</span>
      <span aria-hidden style={{ fontFamily: 'var(--f-brand)', fontSize: 32, fontWeight: 700, color: 'var(--pullim-blue)', lineHeight: 1 }}>{n}</span>
      <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h2>
      <span className="basis-full md:ml-auto md:basis-auto" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.04em', color: 'var(--fg-muted)' }}>
        {meta}
      </span>
    </div>
  )
}

/** ③ 추적 — 종단 트윈 학기 비교 뷰(twin 제공 시). */
function TwinTrack({ twin }: { twin: TwinDiff }) {
  const pct = Math.round(twin.summary.landedRate * 100)
  return (
    <div>
      {/* header: from → to + 반영률 chip */}
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <span
          className="inline-flex items-center gap-2"
          style={{ fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}
        >
          {twin.from} <span aria-hidden style={{ color: 'var(--pullim-blue)' }}>→</span> {twin.to}
        </span>
        <span className="chip brand" aria-label={`반영률 ${pct} 퍼센트`}>
          반영률 {pct}%
        </span>
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
          반영 {twin.summary.landed} · 대기 {twin.summary.pending}
        </span>
      </div>

      {/* per-action outcomes */}
      <ul className="flex list-none flex-col gap-3 p-0">
        {twin.outcomes.map((o, i) => {
          const landed = o.status === 'landed'
          return (
            <li
              key={i}
              className="rv card"
              style={{
                borderLeft: `3px solid ${landed ? 'var(--ok)' : 'var(--hairline)'}`,
                animationDelay: `${i * 0.06}s`,
                padding: '15px 18px',
                background: landed ? 'var(--ok-bg)' : 'var(--bg)',
              }}
            >
              <div className="flex flex-wrap items-start gap-2">
                <span
                  className="mt-[2px] inline-flex flex-none items-center gap-1 rounded-full px-2 py-[2px]"
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    background: landed ? 'var(--ok)' : 'transparent',
                    color: landed ? '#fff' : 'var(--pullim-ink4)',
                    border: landed ? 'none' : '1px solid var(--hairline)',
                  }}
                >
                  {landed ? (
                    <>
                      <IconCheck size={11} /> 반영됨
                    </>
                  ) : (
                    '아직 반영 전'
                  )}
                </span>
                <h3
                  style={{
                    fontSize: 'var(--fs-base)',
                    fontWeight: 700,
                    color: landed ? 'var(--pullim-ink)' : 'var(--pullim-ink4)',
                  }}
                >
                  {o.action.text}
                </h3>
              </div>
              {landed && o.matchedQuote ? (
                <p
                  className="mt-[10px] py-[6px] pl-[11px]"
                  style={{
                    borderLeft: '3px solid var(--pullim-lemon)',
                    background: 'rgba(230,255,76,.14)',
                    borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                    fontFamily: 'var(--f-mono)',
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--fg-muted)',
                  }}
                >
                  <span
                    className="mb-[3px] block"
                    style={{
                      fontSize: 9.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: 'var(--ok)',
                    }}
                  >
                    이번 학기 생기부 반영 근거
                  </span>
                  “{o.matchedQuote}”
                </p>
              ) : (
                <p className="mt-[8px]" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
                  다음 학기 생기부에 아직 안착하지 않았습니다. 계속 추적합니다.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {/* new evidence accrued this term */}
      {twin.newEvidence.length > 0 && (
        <div
          className="rv mt-4 px-4 py-[14px]"
          style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)', background: '#fff' }}
        >
          <div
            className="mb-[10px]"
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--pullim-blue)',
            }}
          >
            이번 학기 새로 쌓인 근거 · {twin.newEvidence.length}건
          </div>
          <ul className="flex list-none flex-col gap-2 p-0">
            {twin.newEvidence.map((e, i) => (
              <li
                key={i}
                className="py-[6px] pl-[11px]"
                style={{
                  borderLeft: '3px solid var(--pullim-lemon)',
                  background: 'rgba(230,255,76,.14)',
                  borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                  fontFamily: 'var(--f-mono)',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--fg-muted)',
                }}
              >
                <span
                  className="mb-[3px] block"
                  style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--pullim-blue)' }}
                >
                  근거 · {e.section}
                </span>
                “{e.quote}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function LoopStages({ data, twin }: { data: AnalyzeResult; twin?: TwinDiff }) {
  const { cohort, diagnosis, rubric } = data

  return (
    <div>
      {/* cohort banner */}
      <div className="on-ink rv flex flex-wrap items-center gap-[10px] px-[18px] py-4" style={{ borderRadius: 'var(--r-md)' }}>
        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: '#fff' }}>진단 코호트</span>
        <span className="chip ghost">{SYS_LABEL[cohort.system] ?? cohort.system}</span>
        {cohort.emphasizeSetuk && <span className="chip accent">세특 정성평가 가중</span>}
        <span className="chip ghost">{REGION_LABEL[cohort.region] ?? cohort.region}</span>
        <span className="chip ghost">{cohort.track === 'core' ? '연중 코칭' : '시즌 집중'}</span>
      </div>

      {/* 01 진단 */}
      <StageHead n="01" title="진단" meta="학종 3역량 · 근거 100%" icon={<IconDiagnose size={18} />} />
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3">
        {diagnosis.criteria.map((c, i) => (
          <div key={i} className="rv card" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
              {COMP_LABEL[c.key] ?? c.key}
            </div>
            {c.mapping && (
              <div className="mt-1" style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--fg-muted)' }}>{c.mapping}</div>
            )}
            <p className="mt-3" style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink2)' }}>
              <b style={{ color: 'var(--ok)' }}>강점</b> · {c.strength}
            </p>
            <p className="mt-[6px]" style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink2)' }}>
              <b style={{ color: 'var(--bad)' }}>약점</b> · {c.weakness}
            </p>
            {c.evidence.map((e, j) => (
              <div
                key={j}
                className="mt-[10px] py-[6px] pl-[11px]"
                style={{
                  borderLeft: '3px solid var(--pullim-lemon)',
                  background: 'rgba(230,255,76,.14)',
                  borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--fg-muted)',
                }}
              >
                <span className="mb-[3px] block" style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--pullim-blue)' }}>
                  근거 · {e.section}
                </span>
                “{e.quote}”
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 02 처방 */}
      <StageHead n="02" title="처방 · 합법 액션" meta="세특 · 정규창체 · 행특만" icon={<IconPrescribe size={18} />} />
      <div className="flex flex-col gap-3">
        {rubric.items.map((it, i) => (
          <div
            key={i}
            className="rv card card-hover"
            style={{ borderLeft: '3px solid var(--pullim-blue)', animationDelay: `${i * 0.06}s`, padding: '16px 18px' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip brand">{AREA_LABEL[it.recordArea] ?? it.recordArea}</span>
              <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{COMP_LABEL[it.competency] ?? it.competency}</span>
            </div>
            <h3 className="mb-1 mt-[9px]" style={{ fontSize: 'var(--fs-base)', fontWeight: 700 }}>{it.text}</h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink2)' }}>{it.rationale}</p>
            <p className="mt-[9px]" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
              근거: <b style={{ color: 'var(--pullim-blue)' }}>“{it.evidence.quote}”</b> · {it.evidence.section}
            </p>
          </div>
        ))}
        {rubric.items.length === 0 && (
          <p className="card" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
            현재 생기부 근거로는 합법 처방을 산출하지 못했습니다. 더 상세한 세특·창체 기록을 추가해 다시 시도해 보세요.
          </p>
        )}
        {rubric.uncertaintyNote && (
          <p className="mt-1" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, lineHeight: 1.6, color: 'var(--pullim-ink4)' }}>
            {rubric.uncertaintyNote}
          </p>
        )}
      </div>

      {/* stripped panel */}
      {rubric.stripped.length > 0 && (
        <div className="rv mt-3 px-4 py-[14px]" style={{ border: '1px dashed var(--hairline)', borderRadius: 'var(--r-md)', background: 'var(--bg)' }}>
          <div className="mb-2" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pullim-ink4)' }}>
            AI가 제안했으나 자동 제외됨 — 대입 미반영 · 금지 항목
          </div>
          <ul className="flex list-none flex-col gap-[6px] p-0">
            {rubric.stripped.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink4)' }}>
                <s>{s.recordArea}</s>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-[2px]" style={{ fontFamily: 'var(--f-mono)', fontSize: 10, background: 'var(--ok-bg)', color: 'var(--ok)' }}>
                  <IconCheck size={11} /> {s.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 03 추적 */}
      <StageHead
        n="03"
        title="추적"
        meta={twin ? '학기별 생기부 변화 비교' : '학기별 실행 추적'}
        icon={<IconTrack size={18} />}
      />
      {twin ? (
        <TwinTrack twin={twin} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-[10px] md:grid-cols-4">
            <div className="p-[13px] text-center" style={{ background: '#fff', border: '1px solid var(--pullim-blue)', borderRadius: 'var(--r-md)', boxShadow: '0 0 0 3px rgba(3,98,218,.08)' }}>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>지금</div>
              <div className="mt-[5px]" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>진단 완료</div>
            </div>
            {['다음 학기', '그다음 학기', '고3 시즌'].map((t, i) => (
              <div key={i} className="p-[13px] text-center" style={{ background: '#fff', border: '1px dashed var(--hairline)', borderRadius: 'var(--r-md)' }}>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--pullim-ink5)' }}>{t}</div>
                <div className="mt-[5px]" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--pullim-ink4)' }}>
                  {i === 2 ? '면접 노드' : '변화 반영?'}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
            <span aria-hidden>🔒</span>
            <span className="sr-only">잠김: </span>
            학기별 생기부 변화 비교(연중 추적)는 연중 구독에서 열립니다. 지금은 단일 스냅샷입니다.
          </p>
        </>
      )}

      {/* 04 증명 */}
      <StageHead n="04" title="증명 · 학부모 리포트" meta="증거 기반" icon={<IconProve size={18} />} />
      <div className="overflow-hidden" style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)' }}>
        <div className="px-[18px] py-[18px]" style={{ borderBottom: '1px solid var(--hairline-soft)', background: 'linear-gradient(120% 140% at 0 0,rgba(230,255,76,.28),#fff)' }}>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--pullim-blue)' }}>학부모 리포트</div>
          <h3 className="mt-1" style={{ fontSize: 'var(--fs-base)', fontWeight: 700 }}>이번 학기, 우리 아이가 할 것</h3>
        </div>
        <div className="px-[18px] py-[18px]" style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink2)' }}>
          {rubric.items.length > 0 ? (
            <ol className="m-0 mb-[10px] list-none space-y-2 p-0">
              {rubric.items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex-none" style={{ fontFamily: 'var(--f-brand)', fontWeight: 700, color: 'var(--pullim-blue)' }}>{i + 1}</span>
                  <span>
                    <b>{it.text}</b> <span style={{ color: 'var(--fg-muted)' }}>({COMP_LABEL[it.competency] ?? it.competency})</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="p-3" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)' }}>
            {rubric.uncertaintyNote}
          </div>
        </div>
      </div>
    </div>
  )
}
