import Link from 'next/link'
import { SiteNav, SiteFooter } from './SiteChrome'

const LOOP = [
  { tag: 'READ', n: '01', t: '진단', d: '학종 3역량으로 강·약점 매핑. 모든 판단에 생기부 원문 인용.', act: false },
  { tag: 'WRITE', n: '02', t: '처방', d: '코호트·전공에 맞춘 합법 액션. 세특·정규창체·행특만.', act: true },
  { tag: 'TRACK', n: '03', t: '추적', d: '학기별 생기부 변화를 비교해 실행 여부를 확인.', act: false },
  { tag: 'PROVE', n: '04', t: '증명', d: '학부모가 읽는 증거 기반 리포트. 시즌엔 면접 노드로.', act: false },
]

const GUARDS = [
  { ic: '진', h: '진단 (설계·대필 아님)', p: '이미 쓰인 생기부를 해석할 뿐, 교사 기재영역을 대필하지 않습니다.' },
  { ic: '§', h: '대입-반영 항목만 처방', p: '세특·정규창체·행특만. 수상·독서·소논문·사교육은 엔진이 자동 제외.' },
  { ic: '무', h: '무학습 · 즉시삭제', p: '생기부는 모델 학습에 쓰지 않고, 처리 후 즉시 폐기합니다.' },
  { ic: '準', h: '면접 준비 (대본 아님)', p: '완성 답변을 외우게 하지 않고, 자기 언어로 답하도록 코치합니다.' },
]

export function Landing() {
  return (
    <>
      <SiteNav />

      {/* HERO */}
      <header
        className="relative overflow-hidden"
        style={{ background: 'var(--color-blue-ink)', color: '#eef1ff' }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            opacity: 0.9,
            background:
              'radial-gradient(60% 80% at 18% 12%,rgba(29,78,216,.55),transparent 60%),radial-gradient(50% 60% at 92% 8%,rgba(255,216,58,.2),transparent 55%),radial-gradient(80% 90% at 70% 110%,rgba(29,78,216,.35),transparent 60%)',
          }}
        />
        <div className="relative mx-auto grid max-w-[1060px] grid-cols-1 items-center gap-8 px-6 pb-[72px] pt-[88px] lg:grid-cols-[1fr_auto]">
          <div>
            <div
              className="font-mono-label flex items-center gap-[10px] text-[12px] uppercase tracking-[0.18em]"
              style={{ color: '#aab6ff' }}
            >
              생기부 실행 루프 ·{' '}
              <b style={{ color: 'var(--color-lemon)', fontWeight: 600 }}>읽기 진단을 넘어 쓰기 코치로</b>
            </div>
            <h1
              className="rv mt-[18px] text-[clamp(38px,6.4vw,76px)] font-extrabold leading-[1.02]"
              style={{ letterSpacing: '-0.03em' }}
            >
              지금 무엇을 해야
              <br />
              <span
                className="font-serif-display italic"
                style={{ fontWeight: 400, letterSpacing: 0, color: 'var(--color-lemon)' }}
              >
                생기부가 채워지는가.
              </span>
            </h1>
            <p
              className="rv mt-6 max-w-[620px] text-[18px] leading-[1.6]"
              style={{ color: '#c6cdf0', animationDelay: '.1s' }}
            >
              고1·고2를 위한 학종 코치. 생기부를 넣으면{' '}
              <b style={{ color: '#fff' }}>진단 → 합법 액션 처방 → 학기별 추적 → 증명</b>까지 한
              흐름으로 돕습니다. 정적 리포트 한 장이 아니라, 학기마다 돌아오는 실행 루프입니다.
            </p>
            <div className="rv mt-[34px] flex flex-wrap gap-[14px]" style={{ animationDelay: '.18s' }}>
              <Link href="/intake" className="btn btn-primary">
                내 생기부 진단하기 →
              </Link>
              <Link href="/?demo=1" className="btn btn-ghost-light">
                결과 예시 보기
              </Link>
            </div>
            <div
              className="rv mt-[46px] flex flex-wrap gap-7 text-[13px]"
              style={{ color: '#aab6ff', animationDelay: '.26s' }}
            >
              <div>
                <b className="font-serif-display block text-[22px] font-extrabold text-white">4단계</b>
                진단·처방·추적·증명
              </div>
              <div>
                <b className="font-serif-display block text-[22px] font-extrabold text-white">
                  세특·창체·행특
                </b>
                대입-반영 항목만 처방
              </div>
              <div>
                <b className="font-serif-display block text-[22px] font-extrabold text-white">무학습</b>
                데이터 미학습 · 즉시삭제
              </div>
            </div>
          </div>

          {/* loop ring */}
          <div aria-hidden className="relative hidden h-[320px] w-[320px] place-items-center lg:grid">
            <svg viewBox="0 0 200 200" fill="none" className="ring-spin h-full w-full">
              <circle cx="100" cy="100" r="86" stroke="rgba(255,255,255,.16)" strokeWidth="1.5" />
              <circle
                cx="100"
                cy="100"
                r="86"
                stroke="var(--color-lemon)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="135 405"
                transform="rotate(-90 100 100)"
              />
              <circle cx="100" cy="14" r="5" fill="var(--color-lemon)" />
              <circle cx="186" cy="100" r="4" fill="#7f8fff" />
              <circle cx="100" cy="186" r="4" fill="#7f8fff" />
              <circle cx="14" cy="100" r="4" fill="#7f8fff" />
            </svg>
            <div className="absolute text-center text-white">
              <div className="font-serif-display text-[44px] leading-none">01–04</div>
              <div
                className="mt-[6px] text-[11px] uppercase tracking-[0.2em]"
                style={{ color: '#aab6ff' }}
              >
                closed loop
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* HOW */}
      <section className="py-[74px]">
        <div className="mx-auto max-w-[1060px] px-6">
          <span className="kicker">작동 방식</span>
          <h2
            className="mt-[14px] text-[clamp(26px,3.4vw,38px)] font-extrabold"
            style={{ letterSpacing: '-0.02em' }}
          >
            읽기만 하는 진단기 대신, 돌아오는 루프.
          </h2>
          <p className="mt-3 max-w-[640px] text-[16px]" style={{ color: 'var(--color-muted)' }}>
            경쟁 서비스는 생기부를 한 번 읽고 PDF 한 장을 줍니다. 풀림은 진단을 입구로 두고, 학생이{' '}
            <b>앞으로 할</b> 합법적 활동을 처방하고, 학기마다 실행을 추적해 증명합니다.
          </p>
          <div className="mt-9 grid grid-cols-2 gap-[14px] md:grid-cols-4">
            {LOOP.map((s, i) => (
              <div
                key={s.n}
                className="rv group relative overflow-hidden rounded-[var(--radius-card)] border p-5 transition-all duration-200 hover:-translate-y-1"
                style={{
                  animationDelay: `${i * 0.08}s`,
                  background: s.act ? 'var(--color-blue-ink)' : '#fff',
                  color: s.act ? '#fff' : 'var(--color-ink)',
                  borderColor: s.act ? 'transparent' : 'var(--color-line)',
                  boxShadow: 'none',
                }}
              >
                <span
                  className="font-mono-label absolute right-4 top-4 text-[10px]"
                  style={{ color: s.act ? 'var(--color-lemon)' : 'var(--color-strike)' }}
                >
                  {s.tag}
                </span>
                <div
                  className="font-serif-display text-[40px] leading-none"
                  style={{ color: s.act ? 'var(--color-lemon)' : 'var(--color-blue)' }}
                >
                  {s.n}
                </div>
                <h3 className="mb-[6px] mt-[10px] text-[17px] font-extrabold">{s.t}</h3>
                <p className="text-[13.5px]" style={{ color: s.act ? '#bcc6ef' : 'var(--color-muted)' }}>
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section
        className="border-y py-[74px]"
        style={{ background: 'var(--color-paper-2)', borderColor: 'var(--color-line-soft)' }}
      >
        <div className="mx-auto max-w-[1060px] px-6">
          <span className="kicker">신뢰 · 가드레일</span>
          <h2
            className="mt-[14px] text-[clamp(26px,3.4vw,38px)] font-extrabold"
            style={{ letterSpacing: '-0.02em' }}
          >
            이길 자리는 ‘진단’이 아니라 ‘합법적 실행’입니다.
          </h2>
          <p className="mt-3 max-w-[640px] text-[16px]" style={{ color: 'var(--color-muted)' }}>
            미성년 민감정보를 다루는 제품이라, 아래 선은 마케팅·구현 전 단계에서 강제됩니다.
          </p>
          <div className="mt-9 grid grid-cols-2 gap-[14px] md:grid-cols-4">
            {GUARDS.map((g, i) => (
              <div
                key={g.ic}
                className="rv surface p-5"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div
                  className="font-serif-display mb-3 grid h-10 w-10 place-items-center rounded-[11px] text-[20px] font-extrabold"
                  style={{ background: 'var(--color-blue-ink)', color: 'var(--color-lemon)' }}
                >
                  {g.ic}
                </div>
                <h4 className="mb-[5px] text-[15px] font-extrabold">{g.h}</h4>
                <p className="text-[12.5px]" style={{ color: 'var(--color-muted)' }}>
                  {g.p}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start gap-4 rounded-[var(--radius-lg)] border p-7 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: 'var(--color-blue-ink)', color: '#eef1ff', borderColor: 'transparent' }}
          >
            <div>
              <div className="font-mono-label text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--color-lemon)' }}>
                start now
              </div>
              <p className="mt-1 text-[18px] font-bold text-white">
                생기부를 넣고, 코호트를 고르면 끝.
              </p>
            </div>
            <Link href="/intake" className="btn btn-primary whitespace-nowrap">
              내 생기부 진단하기 →
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
