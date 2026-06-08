import Link from 'next/link'
import type { ReactNode } from 'react'
import { PullimMark } from './PullimMark'
import { IconArrow } from './icons'

export function SiteNav({ cta }: { cta?: ReactNode }) {
  return (
    <nav
      className="sticky top-0 z-40"
      style={{
        height: 'var(--nav-h)',
        background: 'rgba(255,255,255,.82)',
        backdropFilter: 'saturate(180%) blur(14px)',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <div className="container-x flex h-full items-center justify-between">
        <Link href="/" aria-label="풀림 입시코치 홈">
          <PullimMark size={28} sub="입시코치" />
        </Link>
        {cta ?? (
          <Link href="/intake" className="btn-primary">
            생기부 진단 <IconArrow size={16} />
          </Link>
        )}
      </div>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="on-ink" style={{ borderTop: '1px solid var(--hairline)' }}>
      <div className="container-x flex flex-wrap items-center justify-between gap-4 py-12">
        <PullimMark size={26} sub="입시코치" variant="white" />
        <small style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--fg-muted)', letterSpacing: '0.02em' }}>
          생기부 실행 루프 · 고1–2 연중 코어 + 고3 시즌 비치헤드 · 무학습 · 즉시삭제
        </small>
      </div>
    </footer>
  )
}
