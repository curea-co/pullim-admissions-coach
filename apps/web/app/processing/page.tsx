'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { GuardrailLabel } from '@/components/guardrail-label';
import { SkeletonCard } from '@/components/loading-skeleton';
import { cn } from '@/lib/utils';
import { RequireAuth } from '@/components/auth/require-auth';

// 24h SLA 상태머신 화면 (Phase B).
// 정의 §8: 클럭 시작 = 입력 완료 + 동의 시점. 클럭 종료 = 결과 노출.
// 실 SLA 잡 큐는 Phase C(BullMQ). 본 화면은 Phase A→B의 *상태 시각화*.

type SlaState = 'queued' | 'parsing' | 'diagnosing' | 'completed' | 'delayed';

const stages: { key: SlaState; label: string; detail: string }[] = [
  { key: 'queued', label: '접수 완료', detail: '제출 + 동의 기록 저장' },
  { key: 'parsing', label: '생기부 분석', detail: '키워드 추출 + 평가 기준 매핑' },
  { key: 'diagnosing', label: '진단·면접 준비 생성', detail: 'AI가 §6 가드 준수로 산출 중' },
  { key: 'completed', label: '결과 도착', detail: '학생 화면 노출 + 학부모 리포트 큐잉' },
];

// 데모 가속: 실 24h 대신 90초 사이클로 시연. dev 전용.
const DEMO_CYCLE_MS = 90_000;

export default function ProcessingPage() {
  const submittedAt = useMemo(() => Date.now(), []);
  const [now, setNow] = useState<number>(submittedAt);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = now - submittedAt;
  const stageIdx = Math.min(
    Math.floor((elapsedMs / DEMO_CYCLE_MS) * stages.length),
    stages.length - 1
  );
  const state: SlaState = stages[stageIdx].key;
  const isComplete = state === 'completed';

  return (
    <RequireAuth>
    <>
      <PageHeader />
      <main className="w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            진단 진행 중
          </h1>
          <StepIndicator current="processing" />
        </div>
        <p className="mb-6 text-ink-700">
          제출이 접수되었습니다. AI가 §6 가드레일 안에서 결과를 만들고 있습니다.
        </p>

        <GuardrailLabel variant="general" className="mb-6" />

        <SlaStatusCard
          state={state}
          stageIdx={stageIdx}
          isComplete={isComplete}
        />

        <section className="mt-6 space-y-3">
          {stages.map((s, idx) => (
            <Stage
              key={s.key}
              index={idx}
              label={s.label}
              detail={s.detail}
              state={
                idx < stageIdx ? 'done' : idx === stageIdx ? 'current' : 'todo'
              }
            />
          ))}
        </section>

        {!isComplete && (
          <section className="mt-8">
            <p className="mb-3 text-sm font-semibold text-ink-700">
              생성 결과 미리보기 (도착 시 자동 노출)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </section>
        )}

        <div className="mt-10 flex items-center justify-between border-t border-ink-100 pt-6">
          <Link
            href="/consent"
            className="text-sm text-ink-500 hover:text-ink-900"
          >
            ← 동의로
          </Link>
          <Link
            href="/result"
            className={cn(
              'rounded-xl border px-5 py-3 text-sm font-semibold shadow-sm transition',
              isComplete
                ? 'border-brand-500 bg-brand-600 text-white hover:bg-brand-700'
                : 'border-ink-100 bg-white text-ink-500 hover:text-ink-700'
            )}
          >
            {isComplete ? '결과 보기 →' : '결과 화면 미리 보기'}
          </Link>
        </div>
      </main>
    </>
    </RequireAuth>
  );
}

function SlaStatusCard({
  state,
  stageIdx,
  isComplete,
}: {
  state: SlaState;
  stageIdx: number;
  isComplete: boolean;
}) {
  const pct = Math.round(((stageIdx + (isComplete ? 1 : 0.5)) / stages.length) * 100);
  return (
    <div
      className={cn(
        'rounded-2xl border p-5',
        isComplete
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-brand-200 bg-brand-50/40'
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p
          className={cn(
            'text-base font-semibold',
            isComplete ? 'text-emerald-700' : 'text-brand-700'
          )}
        >
          {labelFor(state)}
        </p>
        <p className="text-xs text-ink-500">
          보통 몇 분 안에 1차 결과가 나와요. 늦어도 24시간 안에 끝나고, 완료되면 알려드릴게요.
        </p>
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/70"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className={cn(
            'h-full transition-all duration-700',
            isComplete ? 'bg-emerald-500' : 'bg-brand-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-500">
        지금은 &ldquo;{labelFor(state)}&rdquo; 단계예요. 끝나면 결과 화면이 자동으로 열려요.
      </p>
    </div>
  );
}

function labelFor(s: SlaState): string {
  return {
    queued: '접수 완료 — 큐 대기 중',
    parsing: '생기부 분석 중',
    diagnosing: '진단·면접 준비 생성 중',
    completed: '결과 도착',
    delayed: '지연 — 운영팀이 보고 있어요',
  }[s];
}

function Stage({
  index,
  label,
  detail,
  state,
}: {
  index: number;
  label: string;
  detail: string;
  state: 'done' | 'current' | 'todo';
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-4 transition',
        state === 'current' && 'border-brand-300 bg-white shadow-sm',
        state === 'done' && 'border-emerald-200 bg-emerald-50/40',
        state === 'todo' && 'border-ink-100 bg-white opacity-70'
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          state === 'current' && 'bg-brand-600 text-white',
          state === 'done' && 'bg-emerald-500 text-white',
          state === 'todo' && 'bg-ink-100 text-ink-500'
        )}
        aria-hidden
      >
        {state === 'done' ? '✓' : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-semibold',
            state === 'current' ? 'text-ink-900' : 'text-ink-700'
          )}
        >
          {label}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{detail}</p>
      </div>
    </div>
  );
}
