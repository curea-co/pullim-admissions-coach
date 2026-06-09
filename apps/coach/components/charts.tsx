/**
 * 풀림 입시코치 리포트 차트 — 손으로 그린 SVG(차트 라이브러리 없음).
 *
 * ★ 신뢰 원칙: 모든 차트는 reportMetrics()가 응답에서 **실제로 센 수량**만 그린다.
 * 점수·합격%·"역량 점수"는 그리지 않는다. 라벨은 항상 근거/활동/반영 **수·비율**.
 *
 * 접근성: 각 차트는 `<figure role="img" aria-label>` + `<figcaption className="sr-only">`로
 * 텍스트 대체(수치 분해)를 제공해 비전 전용이 아니다.
 * prefers-reduced-motion: 본질적 모션 없음(정적 SVG). 색은 currentColor/CSS 변수로 테마화.
 */
import type {
  EvidenceByCompetency,
  PrescriptionsByArea,
  Legality,
  Reflection,
} from '@/lib/report-metrics'

const BLUE = 'var(--pullim-blue, #0362DA)'
const LEMON = 'var(--pullim-lemon, #E6FF4C)'
const HAIR = 'var(--hairline, #E2E8EC)'
const MUTED = 'var(--fg-muted, #45555C)'

/* ───────────────────────── RadarChart — 역량별 근거 수(3축 삼각형) ───────────────────────── */

export function RadarChart({
  data,
  size = 168,
}: {
  data: EvidenceByCompetency[]
  size?: number
}) {
  // 3축 고정. 데이터가 비어도 라벨/축은 항상 그린다.
  const axes = data.length === 3 ? data : data.slice(0, 3)
  const max = Math.max(1, ...axes.map((a) => a.count)) // 0/동일값 graceful
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.34 // 바깥 반지름(라벨 여백 확보)
  // 위(12시)부터 시계방향 120°.
  const angles = [-90, 30, 150].map((d) => (d * Math.PI) / 180)

  const pt = (i: number, r: number) => ({
    x: cx + r * Math.cos(angles[i]),
    y: cy + r * Math.sin(angles[i]),
  })

  // 외곽 삼각형(축 그리드) + 중간 링(50%).
  const outer = angles.map((_, i) => pt(i, R))
  const mid = angles.map((_, i) => pt(i, R * 0.5))
  const poly = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // 데이터 폴리곤(근거 수 비율).
  const dataPts = axes.map((a, i) => pt(i, (a.count / max) * R))

  const summary = axes.map((a) => `${a.label} ${a.count}건`).join(', ')

  return (
    <figure role="img" aria-label={`역량별 근거 수 레이더: ${summary}`} style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="auto" style={{ display: 'block', maxWidth: size }}>
        {/* 축선 */}
        {outer.map((p, i) => (
          <line key={`ax${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={HAIR} strokeWidth={1} />
        ))}
        {/* 그리드(외곽 + 50%) */}
        <polygon points={poly(outer)} fill="none" stroke={HAIR} strokeWidth={1} />
        <polygon points={poly(mid)} fill="none" stroke={HAIR} strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
        {/* 데이터 면 */}
        <polygon
          points={poly(dataPts)}
          fill={BLUE}
          fillOpacity={0.16}
          stroke={BLUE}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* 정점 lemon dot + 카운트 */}
        {dataPts.map((p, i) => {
          const lbl = pt(i, R + 14)
          return (
            <g key={`v${i}`}>
              <circle cx={p.x} cy={p.y} r={3.6} fill={LEMON} stroke={BLUE} strokeWidth={1.4} />
              <text
                x={lbl.x}
                y={lbl.y}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontFamily: 'var(--f-brand)', fontSize: 11, fontWeight: 700, fill: 'var(--pullim-ink, #0D1A1F)' }}
              >
                {axes[i].label}
              </text>
              <text
                x={lbl.x}
                y={lbl.y + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, fill: MUTED }}
              >
                {axes[i].count}건
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="sr-only">역량별 근거 수: {summary}.</figcaption>
    </figure>
  )
}

/* ───────────────────────── DonutRing — 반영률(0–1) ───────────────────────── */

export function DonutRing({
  reflection,
  size = 132,
}: {
  reflection: Reflection
  size?: number
}) {
  const pct = Math.round(reflection.rate * 100)
  const r = size * 0.4
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const dash = (reflection.rate || 0) * circ
  const sw = size * 0.1

  return (
    <figure
      role="img"
      aria-label={`반영률 ${pct}퍼센트, 반영 ${reflection.landed}건, 대기 ${reflection.pending}건`}
      style={{ margin: 0 }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="auto" style={{ display: 'block', maxWidth: size }}>
        {/* 트랙 */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={HAIR} strokeWidth={sw} />
        {/* 진행 arc(12시 시작, 시계방향) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={BLUE}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {/* lemon cap(시작점 악센트) */}
        <circle cx={cx} cy={cy - r} r={sw * 0.34} fill={LEMON} stroke={BLUE} strokeWidth={1.2} />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontFamily: 'var(--f-brand)', fontSize: 26, fontWeight: 700, fill: 'var(--pullim-blue, #0362DA)' }}
        >
          {pct}%
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fill: MUTED }}
        >
          반영률
        </text>
      </svg>
      <figcaption className="sr-only">
        반영률 {pct}퍼센트 — 반영 {reflection.landed}건, 대기 {reflection.pending}건, 새 근거 {reflection.newEvidence}건.
      </figcaption>
    </figure>
  )
}

/* ───────────────────────── MiniBars — 처방 영역 분포(세특/창체/행특) ───────────────────────── */

export function MiniBars({ data }: { data: PrescriptionsByArea[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const summary = data.map((d) => `${d.label} ${d.count}건`).join(', ')
  return (
    <figure role="img" aria-label={`처방 영역 분포: ${summary}`} style={{ margin: 0 }}>
      <div className="flex flex-col gap-[7px]">
        {data.map((d) => (
          <div key={d.area} className="flex items-center gap-[9px]">
            <span
              className="flex-none text-right"
              style={{ width: 36, fontFamily: 'var(--f-mono)', fontSize: 11, color: MUTED }}
            >
              {d.label}
            </span>
            <div
              className="relative flex-1 overflow-hidden"
              style={{ height: 14, background: 'var(--bg, #F4FAFF)', borderRadius: 'var(--r-pill, 999px)' }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${Math.max(d.count > 0 ? 8 : 0, (d.count / max) * 100)}%`,
                  background: BLUE,
                  borderRadius: 'var(--r-pill, 999px)',
                }}
              />
            </div>
            <span
              className="flex-none"
              style={{ width: 30, fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 700, color: 'var(--pullim-ink, #0D1A1F)' }}
            >
              {d.count}건
            </span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">처방 영역 분포: {summary}.</figcaption>
    </figure>
  )
}

/* ───────────────────────── LegalityBar — 합법 처방 vs 자동 제외(2-세그먼트) ───────────────────────── */

export function LegalityBar({ legality }: { legality: Legality }) {
  const { allowed, stripped } = legality
  const total = allowed + stripped
  const pct = Math.round(legality.allowedRate * 100)
  const aw = total === 0 ? 0 : (allowed / total) * 100

  return (
    <figure
      role="img"
      aria-label={`합법 처방 ${allowed}건, 자동 제외 ${stripped}건 — 합법 비율 ${pct}퍼센트`}
      style={{ margin: 0 }}
    >
      <div className="mb-[8px] flex items-baseline gap-2">
        <span style={{ fontFamily: 'var(--f-brand)', fontSize: 22, fontWeight: 700, color: BLUE }}>{pct}%</span>
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: MUTED }}>합법 처방 비율</span>
      </div>
      <div
        className="flex w-full overflow-hidden"
        style={{ height: 16, borderRadius: 'var(--r-pill, 999px)', background: 'var(--bg, #F4FAFF)' }}
      >
        {allowed > 0 && (
          <div style={{ width: `${aw}%`, background: BLUE }} aria-hidden />
        )}
        {stripped > 0 && (
          <div
            style={{
              width: `${100 - aw}%`,
              background: 'repeating-linear-gradient(45deg, var(--hairline, #E2E8EC) 0 4px, transparent 4px 8px)',
              borderLeft: allowed > 0 ? '1px solid #fff' : 'none',
            }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-[8px] flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }}>
        <span className="inline-flex items-center gap-[6px]">
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: BLUE, display: 'inline-block' }} />
          <span style={{ color: 'var(--pullim-ink2, #1F2C32)' }}>합법 처방 {allowed}건</span>
        </span>
        <span className="inline-flex items-center gap-[6px]">
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              background: 'repeating-linear-gradient(45deg, var(--hairline, #E2E8EC) 0 2px, transparent 2px 4px)',
              border: '1px solid var(--hairline, #E2E8EC)',
              display: 'inline-block',
            }}
          />
          <span style={{ color: MUTED }}>자동 제외 {stripped}건</span>
        </span>
      </div>
      <figcaption className="sr-only">
        합법 처방 {allowed}건, 게이트 자동 제외 {stripped}건 — 합법 비율 {pct}퍼센트.
      </figcaption>
    </figure>
  )
}

/* ───────────────────────── 정직 캡션(공용) ───────────────────────── */

export const HONEST_CAPTION =
  '위 지표는 생기부에서 실제로 센 근거·활동·반영 수·비율이며, 합격 가능성이나 역량 점수가 아닙니다.'
