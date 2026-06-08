'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AnalyzeResult } from '@/lib/analyze'
import { LoopStages } from '@/components/LoopStages'

export default function LoopHome() {
  const [data, setData] = useState<AnalyzeResult | null>(null)
  useEffect(() => {
    const raw = sessionStorage.getItem('coach:result')
    if (raw) setData(JSON.parse(raw))
  }, [])
  if (!data) return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold">풀림 입시코치</h1>
      <p className="text-slate-600">생기부를 넣고 진단→처방→증명 루프를 받아보세요.</p>
      <Link href="/intake" className="inline-block rounded bg-blue-700 px-4 py-2 font-semibold text-white">시작하기</Link>
    </div>
  )
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">진단 결과</h1>
        <Link href="/intake" className="text-sm text-blue-700">새로 분석</Link>
      </div>
      <LoopStages data={data} />
    </div>
  )
}
