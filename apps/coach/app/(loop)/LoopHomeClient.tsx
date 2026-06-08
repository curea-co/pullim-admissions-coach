'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { AnalyzeResult } from '@/lib/analyze'
import { LoopStages } from '@/components/LoopStages'
import { Landing } from '@/components/Landing'
import { SiteNav, SiteFooter } from '@/components/SiteChrome'
import { IconArrow } from '@/components/icons'
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
          <div className="flex items-center gap-3">
            {isDemo && <span className="chip accent">예시 데이터</span>}
            <Link href="/intake" className="btn-primary">
              새로 분석 <IconArrow size={16} />
            </Link>
          </div>
        }
      />
      <main className="container-x py-12">
        <div className="mb-7">
          <span className="eyebrow">{isDemo ? '결과 예시' : '진단 결과'}</span>
          <h1
            className="mt-4"
            style={{ fontFamily: 'var(--f-brand)', fontSize: 'clamp(26px,3.4vw,38px)', fontWeight: 700, letterSpacing: 'var(--ls-display)' }}
          >
            생기부 실행 루프
          </h1>
          {isDemo && (
            <p className="mt-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
              아래는 실제 산출 형태의 예시(김서연 · 고2 · 2028 신체제 · 사회계열)입니다. API 호출 없이 표시됩니다.{' '}
              <Link href="/intake" style={{ color: 'var(--pullim-blue)', fontWeight: 700 }}>
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
