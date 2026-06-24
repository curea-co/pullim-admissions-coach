// 홈 히어로 3D 모션 — 서비스 흐름(생기부 입력 → AI 진단 → 면접 준비)을
// 원근감 있는 부유 카드 3장으로 설명. 순수 CSS 3D + keyframes(globals.css),
// prefers-reduced-motion 시 정지. (서버 컴포넌트)
function Chip({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-5 place-items-center rounded-md bg-brand-600 text-[10px] font-bold text-white">
        {n}
      </span>
      <span className="text-[13px] font-semibold text-ink-900">{label}</span>
    </div>
  );
}

const cardBase =
  'absolute w-[clamp(170px,46vw,244px)] rounded-2xl border border-ink-100 bg-white p-4 shadow-[0_24px_60px_-20px_rgba(3,98,218,.35)] [transform-style:preserve-3d]';

export function Hero3D() {
  return (
    <div
      aria-hidden
      className="relative h-[300px] w-full select-none overflow-hidden [perspective:1400px] sm:h-[440px] sm:overflow-visible"
    >
      {/* 배경 글로우 */}
      <span
        className="hero3d-glow pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 rounded-full bg-brand-400/30 blur-3xl animate-[heroGlow_7s_ease-in-out_infinite]"
      />

      {/* 01 · 생기부 입력 */}
      <div
        className={`${cardBase} hero3d-a left-[2%] top-[4%] animate-[heroFloatA_7s_ease-in-out_infinite]`}
        style={{ transform: 'rotateX(12deg) rotateY(-20deg)' }}
      >
        <Chip n="01" label="생기부 입력" />
        <div className="mt-3 space-y-1.5">
          <div className="h-2 w-[88%] rounded bg-ink-100" />
          <div className="flex gap-1.5">
            <div className="h-2 w-10 rounded bg-brand-200" />
            <div className="h-2 w-[55%] rounded bg-ink-100" />
          </div>
          <div className="h-2 w-[70%] rounded bg-ink-100" />
        </div>
        <span className="mt-3 inline-block rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
          개인정보 자동 가림
        </span>
      </div>

      {/* 02 · AI 진단 */}
      <div
        className={`${cardBase} hero3d-b left-[28%] top-[34%] animate-[heroFloatB_8s_ease-in-out_infinite]`}
        style={{ transform: 'rotateX(10deg) rotateY(-16deg) translateZ(40px)' }}
      >
        <Chip n="02" label="AI 진단 · 평가요소" />
        <div className="mt-3 space-y-2">
          {[
            { k: '학업역량', w: '82%' },
            { k: '진로역량', w: '64%' },
            { k: '공동체역량', w: '46%' },
          ].map((r) => (
            <div key={r.k}>
              <div className="flex justify-between text-[11px] text-ink-500">
                <span>{r.k}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-brand-600" style={{ width: r.w }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 03 · 면접 준비 */}
      <div
        className={`${cardBase} hero3d-c left-[10%] top-[60%] animate-[heroFloatC_7.5s_ease-in-out_infinite]`}
        style={{ transform: 'rotateX(14deg) rotateY(-18deg) translateZ(80px)' }}
      >
        <Chip n="03" label="면접 준비" />
        <p className="mt-3 text-[12px] leading-relaxed text-ink-700">
          Q. 동아리 활동에서 가장 의미 있었던 경험은?
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[var(--color-lemon)]" />
          <span className="text-[11px] font-medium text-ink-500">답변 “방향” · 정답 아님</span>
        </div>
      </div>
    </div>
  );
}
