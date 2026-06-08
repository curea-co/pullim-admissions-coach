import type { AnalyzeResult } from '@/lib/analyze'

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

function StageHead({ n, title, meta }: { n: string; title: string; meta: string }) {
  return (
    <div className="mb-4 mt-8 flex items-baseline gap-[14px]">
      <span className="font-serif-display text-[34px]" style={{ color: 'var(--color-blue)' }}>
        {n}
      </span>
      <h3 className="text-[20px] font-extrabold">{title}</h3>
      <span className="font-mono-label ml-auto text-[11px]" style={{ color: 'var(--color-muted)' }}>
        {meta}
      </span>
    </div>
  )
}

export function LoopStages({ data }: { data: AnalyzeResult }) {
  const { cohort, diagnosis, rubric } = data

  return (
    <div>
      {/* cohort banner */}
      <div
        className="rv flex flex-wrap items-center gap-[10px] rounded-[16px] px-[18px] py-4"
        style={{ background: 'var(--color-blue-ink)', color: '#fff' }}
      >
        <span className="text-[15px] font-extrabold">진단 코호트</span>
        <span className="chip">{SYS_LABEL[cohort.system] ?? cohort.system}</span>
        {cohort.emphasizeSetuk && <span className="chip lemon">세특 정성평가 가중</span>}
        <span className="chip">{REGION_LABEL[cohort.region] ?? cohort.region}</span>
        <span className="chip">
          {cohort.track === 'core' ? '코어 트랙 · 연중' : '비치헤드 · 시즌'}
        </span>
      </div>

      {/* 01 진단 */}
      <StageHead n="01" title="진단" meta="학종 3역량 · 근거 100%" />
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3">
        {diagnosis.criteria.map((c, i) => (
          <div
            key={i}
            className="rv surface p-[18px]"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="flex items-center gap-2 text-[14px] font-extrabold">
              {COMP_LABEL[c.key] ?? c.key}
            </div>
            {c.mapping && (
              <div className="font-mono-label mt-1 text-[10.5px]" style={{ color: 'var(--color-muted)' }}>
                {c.mapping}
              </div>
            )}
            <p className="mt-3 text-[12.5px]" style={{ color: 'var(--color-ink-soft)' }}>
              <b className="text-[var(--color-good)]">강점</b> · {c.strength}
            </p>
            <p className="mt-[6px] text-[12.5px]" style={{ color: 'var(--color-ink-soft)' }}>
              <b className="text-[var(--color-bad)]">약점</b> · {c.weakness}
            </p>
            {c.evidence.map((e, j) => (
              <div
                key={j}
                className="mt-[10px] py-[6px] pl-[11px] text-[12px]"
                style={{
                  borderLeft: '3px solid var(--color-lemon-deep)',
                  background: 'rgba(255,216,58,.1)',
                  color: 'var(--color-muted)',
                }}
              >
                <span
                  className="font-mono-label mb-[3px] block text-[9.5px] uppercase tracking-[0.12em]"
                  style={{ color: 'var(--color-blue)' }}
                >
                  근거 · {e.section}
                </span>
                “{e.quote}”
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 02 처방 */}
      <StageHead n="02" title="처방 · 합법 액션" meta="세특 · 정규창체 · 행특만" />
      <div className="flex flex-col gap-3">
        {rubric.items.map((it, i) => (
          <div
            key={i}
            className="rv rounded-[14px] border bg-white px-[18px] py-4 transition-all duration-200 hover:-translate-y-[2px]"
            style={{
              borderColor: 'var(--color-line)',
              borderLeft: '4px solid var(--color-blue)',
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="font-mono-label rounded-[7px] px-[9px] py-1 text-[10.5px] font-semibold"
                style={{ background: 'rgba(29,78,216,.1)', color: 'var(--color-blue)' }}
              >
                {AREA_LABEL[it.recordArea] ?? it.recordArea}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                {COMP_LABEL[it.competency] ?? it.competency}
              </span>
            </div>
            <h4 className="mb-1 mt-[9px] text-[15px] font-bold">{it.text}</h4>
            <p className="text-[13px]" style={{ color: 'var(--color-ink-soft)' }}>
              {it.rationale}
            </p>
            <p className="font-mono-label mt-[9px] text-[11px]" style={{ color: 'var(--color-muted)' }}>
              근거: <b style={{ color: 'var(--color-blue)' }}>“{it.evidence.quote}”</b> ·{' '}
              {it.evidence.section}
            </p>
          </div>
        ))}
        {rubric.items.length === 0 && (
          <p className="surface p-4 text-[13px]" style={{ color: 'var(--color-muted)' }}>
            현재 생기부 근거로는 합법 처방을 산출하지 못했습니다. 더 상세한 세특·창체 기록을
            추가해 다시 시도해 보세요.
          </p>
        )}
      </div>

      {/* stripped panel */}
      {rubric.stripped.length > 0 && (
        <div
          className="rv mt-3 rounded-[14px] border border-dashed px-4 py-[14px]"
          style={{ borderColor: 'var(--color-line)', background: 'var(--color-paper)' }}
        >
          <div
            className="font-mono-label mb-2 text-[11px] uppercase tracking-[0.1em]"
            style={{ color: 'var(--color-strike)' }}
          >
            AI가 제안했으나 자동 제외됨 — 대입 미반영 · 금지 항목
          </div>
          <ul className="flex list-none flex-col gap-[6px] p-0">
            {rubric.stripped.map((s, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 text-[12.5px]"
                style={{ color: 'var(--color-strike)' }}
              >
                <s>{s.recordArea}</s>
                <span
                  className="font-mono-label ml-auto rounded-full px-2 py-[2px] text-[10px]"
                  style={{ background: 'rgba(20,122,77,.08)', color: 'var(--color-good)' }}
                >
                  ✓ {s.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 03 추적 */}
      <StageHead n="03" title="추적" meta="학기별 실행 추적" />
      <div className="grid grid-cols-2 gap-[10px] md:grid-cols-4">
        <div
          className="rounded-[12px] border bg-white p-[13px] text-center"
          style={{ borderColor: 'var(--color-blue)', boxShadow: '0 0 0 3px rgba(29,78,216,.08)' }}
        >
          <div className="font-mono-label text-[10px]" style={{ color: 'var(--color-muted)' }}>
            지금
          </div>
          <div className="mt-[5px] text-[13px] font-extrabold">진단 완료</div>
        </div>
        {['다음 학기', '그다음 학기', '고3 시즌'].map((t, i) => (
          <div
            key={i}
            className="rounded-[12px] border border-dashed bg-white p-[13px] text-center opacity-50"
            style={{ borderColor: 'var(--color-line)' }}
          >
            <div className="font-mono-label text-[10px]" style={{ color: 'var(--color-muted)' }}>
              {t}
            </div>
            <div className="mt-[5px] text-[13px] font-semibold" style={{ color: 'var(--color-muted)' }}>
              {i === 2 ? '면접 노드' : '변화 반영?'}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--color-muted)' }}>
        🔒 학기별 변화 비교(디지털 트윈)는 연중 구독에서 열립니다. 지금은 단일 스냅샷입니다.
      </p>

      {/* 04 증명 */}
      <StageHead n="04" title="증명 · 학부모 리포트" meta="증거 기반" />
      <div
        className="overflow-hidden rounded-[16px] border bg-white"
        style={{ borderColor: 'var(--color-line)' }}
      >
        <div
          className="border-b px-[18px] py-[18px]"
          style={{
            borderColor: 'var(--color-line-soft)',
            background: 'linear-gradient(120% 140% at 0 0,rgba(255,216,58,.22),#fff)',
          }}
        >
          <div
            className="font-mono-label text-[11px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--color-blue)' }}
          >
            parent report
          </div>
          <div className="mt-1 text-[16px] font-extrabold">이번 학기, 우리 아이가 할 것</div>
        </div>
        <div className="px-[18px] py-[18px] text-[13.5px]" style={{ color: 'var(--color-ink-soft)' }}>
          {rubric.items.length > 0 ? (
            <ol className="m-0 mb-[10px] list-none space-y-2 p-0">
              {rubric.items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-serif-display flex-none" style={{ color: 'var(--color-blue)' }}>
                    {i + 1}
                  </span>
                  <span>
                    <b>{it.text}</b>{' '}
                    <span style={{ color: 'var(--color-muted)' }}>
                      ({COMP_LABEL[it.competency] ?? it.competency})
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          <div
            className="rounded-[12px] p-3 text-[12px]"
            style={{ background: 'var(--color-paper)', color: 'var(--color-muted)' }}
          >
            {rubric.uncertaintyNote}
          </div>
        </div>
      </div>
    </div>
  )
}
