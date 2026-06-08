'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { SiteNav, SiteFooter } from '@/components/SiteChrome'
import { IconArrow } from '@/components/icons'

export default function LoopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error)
  }, [error])

  return (
    <>
      <SiteNav cta={<span />} />
      <main id="main" className="container-x grid place-items-center py-24">
        <div className="card w-full max-w-[480px] p-8 text-center">
          <span className="eyebrow" style={{ justifyContent: 'center' }}>오류</span>
          <h1
            className="mt-4"
            style={{ fontFamily: 'var(--f-brand)', fontSize: 'var(--fs-xl)', fontWeight: 700, letterSpacing: 'var(--ls-display)' }}
          >
            결과가 만료되었어요
          </h1>
          <p className="mt-3" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
            진단 결과는 저장되지 않고 즉시 폐기됩니다. 다시 진단을 진행해 주세요.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/intake" className="btn-primary">
              다시 진단하기 <IconArrow size={16} />
            </Link>
            <button onClick={reset} className="btn-secondary">
              다시 시도
            </button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
