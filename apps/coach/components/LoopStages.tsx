'use client'
import type { AnalyzeResult } from '@/lib/analyze'

const AREA_LABEL: Record<string, string> = { SETUK: '세특', CREATIVE_REGULAR: '정규 창체', BEHAVIOR: '행특' }
const COMP_LABEL: Record<string, string> = { ACADEMIC: '학업역량', CAREER: '진로역량', COMMUNITY: '공동체역량' }
const SYS_LABEL: Record<string, string> = { '2027_old': '2027 구체제', '2028_new': '2028 신체제', '2029_new': '2029 신체제' }

export function LoopStages({ data }: { data: AnalyzeResult }) {
  return (
    <div className="space-y-8">
      <header className="rounded-lg bg-blue-50 p-4 text-sm">
        코호트: <b>{SYS_LABEL[data.cohort.system]}</b> · 트랙: {data.cohort.track === 'core' ? '코어(연중)' : '비치헤드(시즌)'}
        {data.cohort.emphasizeSetuk && <span className="ml-2 rounded bg-yellow-200 px-2 py-0.5">세특 정성평가 가중</span>}
      </header>

      <section>
        <h2 className="mb-2 text-lg font-bold">① 진단</h2>
        <div className="space-y-3">
          {data.diagnosis.criteria.map((c, i) => (
            <div key={i} className="rounded border p-3">
              <div className="font-semibold">{COMP_LABEL[c.key] ?? c.key}</div>
              <p className="text-sm">강점: {c.strength}</p>
              <p className="text-sm">약점: {c.weakness}</p>
              <ul className="mt-1 text-xs text-slate-500">{c.evidence.map((e, j) => <li key={j}>“{e.quote}” ({e.section})</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">② 처방 (합법 액션)</h2>
        <div className="space-y-3">
          {data.rubric.items.map((it, i) => (
            <div key={i} className="rounded border-l-4 border-blue-600 bg-white p-3">
              <div className="text-xs text-blue-700">{AREA_LABEL[it.recordArea]} · {COMP_LABEL[it.competency]}</div>
              <p className="font-medium">{it.text}</p>
              <p className="text-xs text-slate-500">근거: “{it.evidence.quote}” ({it.evidence.section})</p>
            </div>
          ))}
          {data.rubric.items.length === 0 && <p className="text-sm text-slate-500">합법 처방이 없습니다.</p>}
        </div>
        {data.rubric.stripped.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">※ {data.rubric.stripped.length}건은 대입 미반영/금지 항목이라 자동 제외되었습니다.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">③ 추적</h2>
        <p className="text-sm text-slate-500">학기별 변화 추적(디지털 트윈)은 연중 구독에서 제공됩니다. 지금은 단일 스냅샷입니다.</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">④ 증명</h2>
        <p className="rounded bg-slate-100 p-3 text-sm">{data.rubric.uncertaintyNote}</p>
      </section>
    </div>
  )
}
