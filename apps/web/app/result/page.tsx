'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { GuardrailLabel } from '@/components/guardrail-label';
import { parkJunho } from '@/lib/mock/park-junho';
import { cn } from '@/lib/utils';
import { competencyLabel, formatStandingLabel } from '@pullim/shared';
import { loadSubmittedProfile, type SubmittedProfile } from '@/lib/submitted-profile';

type Tab = 'interview' | 'diagnosis' | 'improvements';

const tabs: { id: Tab; label: string }[] = [
  { id: 'interview', label: '학생부 종합 전형 면접 준비 팩' },
  { id: 'diagnosis', label: '생기부 진단 가이드' },
  { id: 'improvements', label: '부족 활동 보완안' },
];

export default function ResultPage() {
  const [tab, setTab] = useState<Tab>('interview');
  const [profile, setProfile] = useState<SubmittedProfile | null>(null);
  useEffect(() => {
    setProfile(loadSubmittedProfile());
  }, []);

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
        <p className={cn('text-ink-700', profile && profile.targetUniversities.length > 0 ? 'mb-2' : 'mb-6')}>
          {profile
            ? `${formatStandingLabel(profile)} · 24시간 안에 1차 결과 도착`
            : '예시 학생 (데모) · 고3 2학기 · 이공 · 24시간 안에 1차 결과 도착'}
        </p>
        {profile && profile.targetUniversities.length > 0 && (
          <p className="mb-6 text-sm text-ink-500">
            목표:{' '}
            {profile.targetUniversities
              .map((u, i) => `${i + 1}순위 ${u.name}${u.department ? ` ${u.department}` : ''}`)
              .join(' · ')}
          </p>
        )}

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

        <aside
          role="note"
          className="mb-6 rounded-2xl border border-ink-100 bg-ink-100/50 px-4 py-3 text-sm leading-relaxed text-ink-600"
        >
          아래 면접·진단·보완{' '}
          <strong className="text-ink-900">본문은 예시 결과(데모)</strong>입니다. 실제 개인화
          결과는 출시 버전에서 제공됩니다.
        </aside>

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
      <p className="text-sm text-ink-500">
        데모 미리보기 3건 · 실서비스는 예상 질문 10종
      </p>
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
    </section>
  );
}

function DiagnosisPanel() {
  const flagStyle = {
    strength: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    gap: 'border-amber-200 bg-amber-50 text-amber-700',
  } as const;
  const flagLabel = { strength: '◎ 강점', gap: '△ 보완' } as const;

  return (
    <section className="space-y-4">
      {parkJunho.diagnosisGuide.criteria.map((c) => (
        <article
          key={c.competency}
          className="rounded-2xl border border-ink-100 bg-white p-5"
        >
          <h3 className="text-base font-semibold text-ink-900">
            {competencyLabel[c.competency]}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">{c.summary}</p>

          <ul className="mt-4 space-y-3">
            {c.highlights.map((h, idx) => (
              <li key={idx} className="rounded-xl border border-ink-100 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs font-semibold',
                      flagStyle[h.flag]
                    )}
                  >
                    {flagLabel[h.flag]}
                  </span>
                  <span className="text-sm font-semibold text-ink-900">
                    {h.item}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                  {h.note}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {h.evidence.map((e) => (
                    <li
                      key={e}
                      className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                    >
                      {e}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              앞으로 할 활동 / 정리 방향
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-900">
              {c.nextSteps}
            </p>
          </div>
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
          생기부 키워드 & 강점을 드러낼 방향
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
