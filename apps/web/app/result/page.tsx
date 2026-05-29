'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { GuardrailLabel } from '@/components/guardrail-label';
import { parkJunho } from '@/lib/mock/park-junho';
import { cn } from '@/lib/utils';

type Tab = 'interview' | 'diagnosis' | 'improvements';

const tabs: { id: Tab; label: string }[] = [
  { id: 'interview', label: '학생부 종합 전형 면접 준비 팩' },
  { id: 'diagnosis', label: '생기부 진단 가이드' },
  { id: 'improvements', label: '부족 활동 보완안' },
];

export default function ResultPage() {
  const [tab, setTab] = useState<Tab>('interview');

  return (
    <>
      <PageHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            진단 결과
          </h1>
          <StepIndicator current="result" />
        </div>
        <p className="mb-6 text-ink-700">
          박준호 (mock) · 고3 2학기 · 공학계열 · 24시간 안에 1차 결과 도착
        </p>

        <GuardrailLabel
          variant={
            tab === 'interview'
              ? 'interview'
              : tab === 'diagnosis'
              ? 'diagnosis'
              : 'general'
          }
          className="mb-6"
        />

        {/* Tabs */}
        <div
          role="tablist"
          className="mb-6 flex flex-wrap gap-1 rounded-xl bg-ink-100/60 p-1"
        >
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-700'
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'interview' && <InterviewPanel />}
        {tab === 'diagnosis' && <DiagnosisPanel />}
        {tab === 'improvements' && <ImprovementsPanel />}

        <div className="mt-10 flex items-center justify-between border-t border-ink-100 pt-6">
          <Link
            href="/consent"
            className="text-sm text-ink-500 hover:text-ink-900"
          >
            ← 동의로
          </Link>
          <Link
            href="/parent"
            className="rounded-xl border border-brand-300 px-5 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            학부모 리포트 보기 →
          </Link>
        </div>
      </main>
    </>
  );
}

function InterviewPanel() {
  return (
    <section className="space-y-4">
      {parkJunho.interviewPack.questions.map((q, idx) => (
        <article
          key={idx}
          className="rounded-2xl border border-ink-100 bg-white p-5"
        >
          <header className="flex items-baseline gap-3">
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              Q{idx + 1}
            </span>
            <h3 className="text-base font-semibold leading-snug text-ink-900">
              {q.question}
            </h3>
          </header>
          <dl className="mt-4 space-y-3 text-sm leading-relaxed">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                답변 방향
              </dt>
              <dd className="mt-1 text-ink-900">{q.direction}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                근거 생기부 항목
              </dt>
              <dd className="mt-1">
                <ul className="space-y-1">
                  {q.evidence.map((e) => (
                    <li key={e} className="flex gap-2 text-ink-700">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                꼬리질문 대비
              </dt>
              <dd className="mt-1 text-ink-700">{q.followUp}</dd>
            </div>
          </dl>
        </article>
      ))}
      <p className="text-xs text-ink-500">
        Phase A 시각 셸에 3건만 노출. 실 서비스는 정의 §4-1대로 질문 10종 제공.
      </p>
    </section>
  );
}

function DiagnosisPanel() {
  const scoreStyle = {
    강함: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    보통: 'bg-amber-50 text-amber-700 border-amber-200',
    약함: 'bg-rose-50 text-rose-700 border-rose-200',
  } as const;
  return (
    <section className="space-y-4">
      {parkJunho.diagnosisGuide.criteria.map((c) => (
        <article
          key={c.name}
          className="rounded-2xl border border-ink-100 bg-white p-5"
        >
          <header className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink-900">{c.name}</h3>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                scoreStyle[c.score]
              )}
            >
              {c.score}
            </span>
          </header>
          <dl className="mt-3 space-y-2 text-sm leading-relaxed">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                관찰
              </dt>
              <dd className="mt-0.5 text-ink-700">{c.observation}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                앞으로 할 활동 / 정리 방향
              </dt>
              <dd className="mt-0.5 text-ink-900">{c.nextSteps}</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}

function ImprovementsPanel() {
  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-ink-100 bg-white p-5">
        <h3 className="text-base font-semibold text-ink-900">
          생기부 키워드 & 학부 적합도
        </h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {parkJunho.improvements.keywords.map((k) => (
            <span
              key={k}
              className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700"
            >
              {k}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-700">
          {parkJunho.improvements.fitDelta}
        </p>
      </article>
      <article>
        <h3 className="mb-3 text-base font-semibold text-ink-900">
          보완 활동 제안 3건 — 학생 본인이 앞으로 할 활동
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {parkJunho.improvements.suggestions.map((s, idx) => (
            <div
              key={s.title}
              className="rounded-2xl border border-ink-100 bg-white p-5"
            >
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                제안 {idx + 1}
              </span>
              <h4 className="mt-2 text-base font-semibold text-ink-900">
                {s.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
