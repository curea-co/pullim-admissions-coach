'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { TwinDiff } from '@pullim/engine'
import type { AnalyzeResult } from '@/lib/analyze'
import { LoopStages } from '@/components/LoopStages'
import { Landing } from '@/components/Landing'
import { SiteNav, SiteFooter } from '@/components/SiteChrome'
import { IconArrow } from '@/components/icons'
import { SAMPLE_RESULT, SAMPLE_TWIN_DIFF } from '@/lib/sample'
import { latestRun } from '@/lib/history'

export function LoopHomeClient() {
  const params = useSearchParams()
  const demo = params.get('demo')
  const isTwinDemo = demo === 'twin'
  const isDemo = demo === '1' || isTwinDemo
  const [data, setData] = useState<AnalyzeResult | null>(null)
  const [twin, setTwin] = useState<TwinDiff | undefined>(undefined)

  useEffect(() => {
    if (isTwinDemo) {
      setData(SAMPLE_RESULT) // 고2-2 (나중 학기)
      setTwin(SAMPLE_TWIN_DIFF) // 고2-1 → 고2-2 비교
      return
    }
    if (isDemo) {
      setData(SAMPLE_RESULT)
      return
    }
    const apply = (parsed: AnalyzeResult | null) => {
      // Defend against stale/truncated cache: only swap to the result view
      // when the shape LoopStages destructures is fully present.
      if (parsed?.cohort && parsed?.diagnosis?.criteria && parsed?.rubric?.items) {
        setData(parsed)
        // 종단 트윈(priorSaengbu 처리 시 채워짐) → ③ 추적에 실데이터로 공급.
        if (parsed?.twin?.outcomes && parsed?.twin?.summary) {
          setTwin(parsed.twin as TwinDiff)
        }
        return true
      }
      return false
    }

    const raw = sessionStorage.getItem('coach:result')
    if (raw) {
      try {
        if (apply(JSON.parse(raw) as AnalyzeResult)) return
      } catch {
        /* ignore malformed cache */
      }
    }
    // 세션에 현재 결과가 없으면(새 탭·재방문) 본인 기기에 저장된 가장 최근 결과를 복원.
    const last = latestRun()
    if (last) apply(last.result)
  }, [isDemo, isTwinDemo])

  // Result swap depends on ?demo=1 / sessionStorage; the prerender fallback
  // (page.tsx Suspense) renders <Landing /> so there is no blank flash.
  if (!data) return <Landing />

  return (
    <>
      <SiteNav
        cta={
          <div className="flex items-center gap-2 sm:gap-3">
            {isDemo && <span className="chip accent">예시 데이터</span>}
            {!isDemo && (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-mini"
                  title="이 결과를 PDF로 저장하거나 인쇄합니다"
                >
                  PDF 저장
                </button>
                <Link href="/runs" className="btn-mini">
                  내 기록
                </Link>
              </>
            )}
            <Link href="/intake" className="btn-primary">
              새로 분석 <IconArrow size={16} />
            </Link>
          </div>
        }
      />
      <main id="main" className="container-x py-12">
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
          {isTwinDemo && (
            <p className="mt-2 inline-flex flex-wrap items-center gap-2" style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)' }}>
              <span className="chip accent">학기 비교 예시: 고2-1 → 고2-2</span>
              <span>③ 추적 단계에서 지난 학기 처방이 실제 생기부에 반영됐는지 대조합니다.</span>
            </p>
          )}
          {!isDemo && twin && (
            <p className="mt-2 inline-flex flex-wrap items-center gap-2" style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)' }}>
              <span className="chip accent">
                학기 비교: {twin.from} → {twin.to}
              </span>
              <span>③ 추적 단계에서 지난 학기 처방이 실제 생기부에 반영됐는지 대조합니다.</span>
            </p>
          )}
        </div>
        <LoopStages data={data} twin={twin} />
      </main>
      <SiteFooter />
    </>
  )
}
