import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { parkJunho } from '@/lib/mock/park-junho';

// 정의 §6.3 가드: 자녀 생기부 원문·결과물 전문 미노출. 진행 요약만.
// Phase A 시각 셸. 실 발송(SES)·인증·가구 모델은 Phase E.

export default function ParentReportPage() {
  const r = parkJunho.parentReport;
  return (
    <>
      <PageHeader />
      <main className="w-full max-w-3xl px-6 py-10">
        <div className="mb-6">
          <p className="text-sm text-ink-500">학부모 주간 리포트</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900">
            자녀 진행 요약
          </h1>
          <p className="mt-2 text-ink-700">
            {r.weekOf} 주간 · {parkJunho.identity.displayLabel}
          </p>
        </div>

        <PrivacyNote />

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card title="이번 주 진행 상태" emphasis>
            <p className="text-base font-semibold text-brand-700">{r.progress}</p>
          </Card>
          <Card title="다음 주 계획">
            <p className="text-sm leading-relaxed text-ink-700">{r.nextWeekPlan}</p>
          </Card>
        </section>

        <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-base font-semibold text-ink-900">
            이번 주 요약 (3가지)
          </h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-ink-700">
            {r.summaryHighlights.map((line, idx) => (
              <li key={idx} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6 rounded-2xl border border-ink-100 bg-ink-100/40 p-5">
          <h2 className="text-base font-semibold text-ink-900">
            자녀가 받는 결과 (학부모는 상세 본문을 보지 않습니다)
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-700">
            <li className="flex items-center justify-between">
              <span>학생부 종합 전형 면접 준비 팩</span>
              <span className="text-xs font-medium text-brand-700">학생 화면 전용</span>
            </li>
            <li className="flex items-center justify-between">
              <span>생기부 진단 가이드</span>
              <span className="text-xs font-medium text-brand-700">학생 화면 전용</span>
            </li>
            <li className="flex items-center justify-between">
              <span>부족 활동 보완안</span>
              <span className="text-xs font-medium text-brand-700">학생 화면 전용</span>
            </li>
          </ul>
        </section>

        <div className="mt-10 flex items-center justify-between border-t border-ink-100 pt-6">
          <Link href="/" className="text-sm text-ink-500 hover:text-ink-900">
            ← 처음으로
          </Link>
          <span className="text-xs text-ink-500">
            주간 리포트는 매주 일요일 이메일로도 발송됩니다 (Phase E)
          </span>
        </div>
      </main>
    </>
  );
}

function Card({
  title,
  emphasis,
  children,
}: {
  title: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        emphasis
          ? 'rounded-2xl border border-brand-200 bg-brand-50/50 p-5'
          : 'rounded-2xl border border-ink-100 bg-white p-5'
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PrivacyNote() {
  return (
    <aside
      role="note"
      className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm leading-relaxed text-ink-700"
    >
      <p className="font-semibold text-ink-900">자녀 개인정보 보호 안내</p>
      <p className="mt-1 text-ink-500">
        본 리포트는 자녀의 *진행 요약*만 제공합니다. 자녀의 생기부 원문이나
        AI 결과물의 본문은 학부모에게 노출되지 않습니다. 학생과 학부모의 권한이
        분리되어 있습니다.
      </p>
    </aside>
  );
}
