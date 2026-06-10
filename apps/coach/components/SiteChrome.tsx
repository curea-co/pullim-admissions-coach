import Link from 'next/link'
import type { ReactNode } from 'react'
import { PullimMark } from './PullimMark'
import { IconArrow } from './icons'

/**
 * pullim.ai 글로벌 내비게이션과 동일한 구조로 맞춘 제품 내비.
 * 좌측: 풀림 입시코치 로고(전용 07 심볼) · 우측: 글로벌 메뉴(데스크톱) + CTA 슬롯.
 * 메뉴 항목은 pullim.ai 본 사이트로 연결돼, 독립 실행 중에도 OS의 일부처럼 느껴지게 한다.
 */
const NAV_ITEMS = [
  { label: '제품', href: 'https://pullim.ai/products' },
  { label: '가격', href: 'https://pullim.ai/pricing' },
  { label: '학원·학교', href: 'https://pullim.ai/for-schools' },
  { label: '주니어', href: 'https://pullim.ai/junior' },
  { label: '풀림이란', href: 'https://pullim.ai/about' },
]

export function SiteNav({ cta }: { cta?: ReactNode }) {
  return (
    <header
      className="no-print sticky top-0 z-40"
      style={{
        height: 'var(--nav-h)',
        background: 'rgba(255,255,255,.82)',
        backdropFilter: 'saturate(140%) blur(14px)',
        WebkitBackdropFilter: 'saturate(140%) blur(14px)',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <div className="container-x flex h-full items-center justify-between">
        <Link href="/" aria-label="풀림 입시코치 홈" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <PullimMark size={28} symbol="/symbols/07_exam.svg" sub="입시코치" />
        </Link>

        <div className="flex items-center gap-5 lg:gap-7">
          {/* Desktop global menu (lg+) — pullim.ai 본 사이트 연결 */}
          <nav className="hidden lg:block" aria-label="주 메뉴">
            <ul className="flex items-center" style={{ gap: 26, listStyle: 'none', padding: 0, margin: 0 }}>
              {NAV_ITEMS.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    style={{
                      fontFamily: 'var(--f-kr)',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--fg-muted)',
                      padding: '8px 0',
                    }}
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {cta ?? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/runs" className="btn-mini">
                내 기록
              </Link>
              <Link href="/intake" className="btn-primary">
                생기부 진단 <IconArrow size={16} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="no-print on-ink" style={{ borderTop: '1px solid var(--hairline)' }}>
      <div className="container-x flex flex-wrap items-center justify-between gap-4 py-12">
        <PullimMark size={26} symbol="/symbols/07_exam.svg" sub="입시코치" variant="white" />
        <small style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--fg-muted)', letterSpacing: '0.02em' }}>
          생기부 실행 루프 · 고1–2 연중 코어 + 고3 시즌 비치헤드 · 무학습 · 즉시삭제
        </small>
      </div>
    </footer>
  )
}
