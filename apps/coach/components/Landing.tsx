import Link from 'next/link'
import type { ReactNode } from 'react'
import { SiteNav, SiteFooter } from './SiteChrome'
import {
  IconDiagnose,
  IconPrescribe,
  IconTrack,
  IconProve,
  IconShield,
  IconLegal,
  IconCheck,
  IconArrow,
  IconLoop,
} from './icons'

const LOOP: { tag: string; n: string; t: string; d: string; act: boolean; Icon: (p: { size?: number; accent?: boolean }) => ReactNode }[] = [
  { tag: 'DIAGNOSE', n: '01', t: '진단', d: '학종 3역량으로 강·약점 매핑. 모든 판단에 생기부 원문 인용.', act: false, Icon: IconDiagnose },
  { tag: 'PRESCRIBE', n: '02', t: '처방', d: '코호트·전공에 맞춘 합법 액션. 세특·정규창체·행특만.', act: true, Icon: IconPrescribe },
  { tag: 'TRACK', n: '03', t: '추적', d: '학기별 생기부 변화를 비교해 실행 여부를 확인.', act: false, Icon: IconTrack },
  { tag: 'PROVE', n: '04', t: '증명', d: '학부모가 읽는 증거 기반 리포트. 시즌엔 면접 노드로.', act: false, Icon: IconProve },
]

const GUARDS: { Icon: (p: { size?: number; accent?: boolean }) => ReactNode; h: string; p: string }[] = [
  { Icon: IconDiagnose, h: '진단 (설계·대필 아님)', p: '이미 쓰인 생기부를 해석할 뿐, 교사 기재영역을 대필하지 않습니다.' },
  { Icon: IconLegal, h: '대입-반영 항목만 처방', p: '세특·정규창체·행특만. 수상·독서·소논문·사교육은 엔진이 자동 제외.' },
  { Icon: IconShield, h: '무학습 · 즉시삭제', p: '생기부는 모델 학습에 쓰지 않고, 처리 후 즉시 폐기합니다.' },
  { Icon: IconCheck, h: '면접 준비 (대본 아님)', p: '완성 답변을 외우게 하지 않고, 자기 언어로 답하도록 코치합니다.' },
]

export function Landing() {
  return (
    <>
      <SiteNav />

      <main id="main">
      {/* HERO — on-ink */}
      <section className="on-ink relative overflow-hidden" aria-labelledby="hero-heading">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(700px 380px at 14% -6%, rgba(3,98,218,.42), transparent 60%), radial-gradient(560px 320px at 92% 4%, rgba(230,255,76,.12), transparent 55%)',
          }}
        />
        <div className="container-x relative grid grid-cols-1 items-center gap-10 pb-[clamp(64px,8vw,110px)] pt-[clamp(72px,9vw,120px)] lg:grid-cols-[1fr_auto]">
          <div>
            <span className="eyebrow" style={{ color: 'var(--pullim-lemon)' }}>
              <span style={{ color: 'var(--pullim-lemon)' }}>생기부 실행 루프</span>
            </span>
            <h1
              id="hero-heading"
              className="rv mt-5"
              style={{
                fontFamily: 'var(--f-brand)',
                fontSize: 'clamp(38px,6.2vw,72px)',
                fontWeight: 700,
                lineHeight: 'var(--lh-tight)',
                letterSpacing: 'var(--ls-display)',
              }}
            >
              지금 무엇을 해야
              <br />
              <span style={{ color: 'var(--pullim-lemon)' }}>생기부가 채워지는가.</span>
            </h1>
            <p className="rv mt-6 max-w-[620px]" style={{ fontSize: 'var(--fs-md)', color: 'var(--fg-muted)', animationDelay: '.1s' }}>
              고1·고2를 위한 학종 코치. 생기부를 넣으면{' '}
              <b style={{ color: '#fff' }}>진단 → 합법 액션 처방 → 학기별 추적 → 증명</b>까지 한 흐름으로
              돕습니다. 정적 리포트 한 장이 아니라, 학기마다 돌아오는 실행 루프입니다.
            </p>
            <div className="rv mt-9 flex flex-wrap gap-3" style={{ animationDelay: '.18s' }}>
              <Link href="/intake" className="btn-primary">
                내 생기부 진단하기 <IconArrow size={16} />
              </Link>
              <Link href="/?demo=1" className="btn-ghost-light">
                결과 예시 보기
              </Link>
            </div>
            <div className="rv mt-12 flex flex-wrap gap-8" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)', animationDelay: '.26s' }}>
              {[
                { k: '4단계', v: '진단·처방·추적·증명' },
                { k: '세특·창체·행특', v: '대입-반영 항목만 처방' },
                { k: '무학습', v: '데이터 미학습 · 즉시삭제' },
              ].map((s) => (
                <div key={s.k}>
                  <b style={{ fontFamily: 'var(--f-brand)', display: 'block', fontSize: 'var(--fs-lg)', fontWeight: 700, color: '#fff' }}>
                    {s.k}
                  </b>
                  {s.v}
                </div>
              ))}
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
                stroke="var(--pullim-lemon)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="135 405"
                transform="rotate(-90 100 100)"
              />
              <circle cx="100" cy="14" r="5" fill="var(--pullim-lemon)" />
              <circle cx="186" cy="100" r="4" fill="var(--pb-4)" />
              <circle cx="100" cy="186" r="4" fill="var(--pb-4)" />
              <circle cx="14" cy="100" r="4" fill="var(--pb-4)" />
            </svg>
            <div className="absolute text-center" style={{ color: '#fff' }}>
              <IconLoop size={30} accent />
              <div style={{ fontFamily: 'var(--f-brand)', fontSize: 42, fontWeight: 700, lineHeight: 1, marginTop: 8 }}>01–04</div>
              <div className="eyebrow muted mt-2" style={{ color: 'rgba(240,246,251,.55)', justifyContent: 'center' }}>
                폐쇄 루프
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW */}
      <section style={{ paddingBlock: 'clamp(64px,8vw,110px)' }}>
        <div className="container-x">
          <span className="eyebrow">작동 방식</span>
          <h2 className="mt-4" style={{ fontFamily: 'var(--f-brand)', fontSize: 'clamp(26px,3.4vw,38px)', fontWeight: 700, letterSpacing: 'var(--ls-display)' }}>
            읽기만 하는 진단기 대신, 돌아오는 루프.
          </h2>
          <p className="mt-3 max-w-[640px]" style={{ fontSize: 'var(--fs-base)', color: 'var(--fg-muted)' }}>
            경쟁 서비스는 생기부를 한 번 읽고 PDF 한 장을 줍니다. 풀림은 진단을 입구로 두고, 학생이{' '}
            <b style={{ color: 'var(--fg)' }}>앞으로 할</b> 합법적 활동을 처방하고, 학기마다 실행을 추적해 증명합니다.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-[14px] md:grid-cols-4">
            {LOOP.map((s, i) => {
              const Icon = s.Icon
              return (
                <div
                  key={s.n}
                  className={`rv card card-hover ${s.act ? 'on-ink' : ''}`}
                  style={{
                    animationDelay: `${i * 0.08}s`,
                    background: s.act ? 'var(--pullim-ink)' : 'var(--bg-raised)',
                    borderColor: s.act ? 'transparent' : 'var(--hairline)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="sg" style={{ background: s.act ? 'rgba(255,255,255,.08)' : 'var(--pb-1)', color: s.act ? 'var(--pullim-lemon)' : 'var(--pullim-blue)' }}>
                      <Icon size={18} accent={s.act} />
                    </span>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '0.12em', color: s.act ? 'var(--pullim-lemon)' : 'var(--pullim-ink4)' }}>
                      {s.tag}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--f-brand)', fontSize: 38, fontWeight: 700, lineHeight: 1, marginTop: 14, color: s.act ? 'var(--pullim-lemon)' : 'var(--pullim-blue)' }}>
                    {s.n}
                  </div>
                  <h3 className="mb-[6px] mt-[10px]" style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: s.act ? '#fff' : 'var(--fg)' }}>
                    {s.t}
                  </h3>
                  <p style={{ fontSize: 'var(--fs-sm)', color: s.act ? 'rgba(240,246,251,.72)' : 'var(--fg-muted)', lineHeight: 1.6 }}>{s.d}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section style={{ background: 'var(--pullim-paper3)', borderBlock: '1px solid var(--hairline-soft)', paddingBlock: 'clamp(64px,8vw,110px)' }}>
        <div className="container-x">
          <span className="eyebrow">신뢰 · 가드레일</span>
          <h2 className="mt-4" style={{ fontFamily: 'var(--f-brand)', fontSize: 'clamp(26px,3.4vw,38px)', fontWeight: 700, letterSpacing: 'var(--ls-display)' }}>
            이길 자리는 ‘진단’이 아니라 ‘합법적 실행’입니다.
          </h2>
          <p className="mt-3 max-w-[640px]" style={{ fontSize: 'var(--fs-base)', color: 'var(--fg-muted)' }}>
            미성년 민감정보를 다루는 제품이라, 아래 선은 마케팅·구현 전 단계에서 강제됩니다.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-[14px] md:grid-cols-4">
            {GUARDS.map((g, i) => {
              const Icon = g.Icon
              return (
                <div key={g.h} className="rv card" style={{ animationDelay: `${i * 0.07}s` }}>
                  <span className="sg brand mb-3">
                    <Icon size={18} />
                  </span>
                  <h3 className="mb-[5px]" style={{ fontSize: 'var(--fs-base)', fontWeight: 700 }}>{g.h}</h3>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)', lineHeight: 1.6 }}>{g.p}</p>
                </div>
              )
            })}
          </div>

          <div
            className="on-ink mt-10 flex flex-col items-start gap-4 p-7 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderRadius: 'var(--r-lg)' }}
          >
            <div>
              <span className="eyebrow" style={{ color: 'var(--pullim-lemon)' }}>지금 시작</span>
              <p className="mt-2" style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: '#fff' }}>
                생기부를 넣고, 코호트를 고르면 끝.
              </p>
            </div>
            <Link href="/intake" className="btn-primary whitespace-nowrap">
              내 생기부 진단하기 <IconArrow size={16} />
            </Link>
          </div>
        </div>
      </section>
      </main>

      <SiteFooter />
    </>
  )
}
