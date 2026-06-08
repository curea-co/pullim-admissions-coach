import Link from 'next/link'
import type { ReactNode } from 'react'

export function SiteNav({ cta }: { cta?: ReactNode }) {
  return (
    <nav
      className="sticky top-0 z-40 border-b"
      style={{
        background: 'rgba(250,247,239,.82)',
        backdropFilter: 'blur(8px)',
        borderColor: 'var(--color-line-soft)',
      }}
    >
      <div className="mx-auto flex h-[60px] max-w-[1060px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-[9px] font-extrabold no-underline">
          <span className="brand-dot" aria-hidden />
          <span>
            풀림 <span style={{ color: 'var(--color-muted)', fontWeight: 600 }}>입시코치</span>
          </span>
        </Link>
        {cta ?? (
          <Link
            href="/intake"
            className="rounded-full px-4 py-[9px] text-[13px] font-bold text-white no-underline"
            style={{ background: 'var(--color-ink)' }}
          >
            생기부 진단 →
          </Link>
        )}
      </div>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer style={{ background: 'var(--color-ink)', color: '#9b978a' }}>
      <div className="mx-auto flex max-w-[1060px] flex-wrap items-center justify-between gap-[14px] px-6 py-12">
        <div className="flex items-center gap-[9px] font-extrabold text-white">
          <span className="brand-dot on-dark" aria-hidden /> 풀림 입시코치
        </div>
        <small className="text-[12px]">
          생기부 실행 루프 · 고1–2 연중 코어 + 고3 시즌 비치헤드 · 무학습 · 즉시삭제
        </small>
      </div>
    </footer>
  )
}
