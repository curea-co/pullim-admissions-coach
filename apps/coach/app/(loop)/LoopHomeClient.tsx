'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { AnalyzeResult } from '@/lib/analyze'
import { LoopStages } from '@/components/LoopStages'
import { Landing } from '@/components/Landing'
import { SiteNav, SiteFooter } from '@/components/SiteChrome'
import { SAMPLE_RESULT } from '@/lib/sample'

export function LoopHomeClient() {
  const params = useSearchParams()
  const isDemo = params.get('demo') === '1'
  const [data, setData] = useState<AnalyzeResult | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isDemo) {
      setData(SAMPLE_RESULT)
      setReady(true)
      return
    }
    const raw = sessionStorage.getItem('coach:result')
    if (raw) {
      try {
        setData(JSON.parse(raw))
      } catch {
        /* ignore malformed cache */
      }
    }
    setReady(true)
  }, [isDemo])

  // avoid flashing the landing before sessionStorage is read
  if (!ready) return <div aria-hidden style={{ minHeight: '100vh' }} />

  if (!data) return <Landing />

  return (
    <>
      <SiteNav
        cta={
          <div className="flex items-center gap-4">
            {isDemo && (
              <span
                className="font-mono-label rounded-full px-3 py-1 text-[11px]"
                style={{ background: 'rgba(240,189,0,.18)', color: 'var(--color-lemon-deep)' }}
              >
                예시 데이터
              </span>
            )}
            <Link
              href="/intake"
              className="rounded-full px-4 py-[9px] text-[13px] font-bold text-white no-underline"
              style={{ background: 'var(--color-ink)' }}
            >
              새로 분석 →
            </Link>
          </div>
        }
      />
      <main className="mx-auto max-w-[1060px] px-6 py-10">
        <div className="mb-6">
          <span className="kicker">{isDemo ? '결과 예시' : '진단 결과'}</span>
          <h1
            className="mt-[14px] text-[clamp(24px,3.4vw,34px)] font-extrabold"
            style={{ letterSpacing: '-0.02em' }}
          >
            생기부 실행 루프
          </h1>
          {isDemo && (
            <p className="mt-2 text-[14px]" style={{ color: 'var(--color-muted)' }}>
              아래는 실제 산출 형태의 예시(김서연 · 고2 · 2028 신체제 · 사회계열)입니다. API 호출
              없이 표시됩니다.{' '}
              <Link href="/intake" style={{ color: 'var(--color-blue)', fontWeight: 700 }}>
                내 생기부로 진단하기 →
              </Link>
            </p>
          )}
        </div>
        <LoopStages data={data} />
      </main>
      <SiteFooter />
    </>
  )
}
