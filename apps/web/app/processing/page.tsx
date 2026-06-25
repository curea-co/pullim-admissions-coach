'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { GuardrailLabel } from '@/components/guardrail-label';
import { ErrorState } from '@/components/error-state';
import { cn } from '@/lib/utils';
import { RequireAuth } from '@/components/auth/require-auth';
import { loadSubmittedPayload, clearSubmittedPayload } from '@/lib/submitted-payload';
import { saveAnalyzeResult } from '@/lib/result-view';

// 분석 진행 단계 — 실 /api/analyze 요청을 기반으로 구동한다.
// 24h SLA 가짜 타이머 제거. 보통 1분 내로 완료(demo는 즉시).

type AnalysisPhase = 'calling' | 'diagnosing' | 'done' | 'error';

const STEP_SEQUENCE: { key: AnalysisPhase; label: string; detail: string }[] = [
  { key: 'calling', label: '생기부 분석', detail: '키워드 추출 + 평가 기준 매핑' },
  { key: 'diagnosing', label: '진단·면접 준비 생성', detail: 'AI가 §6 가드 준수로 산출 중' },
  { key: 'done', label: '결과 도착', detail: '결과 화면을 불러옵니다' },
];

export default function ProcessingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<AnalysisPhase>('calling');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function runAnalysis() {
      const payload = loadSubmittedPayload();
      if (!payload) {
        // payload 없음 — submit 화면으로 돌아가게 안내
        setErrorMsg('제출 데이터를 찾을 수 없습니다. 처음부터 다시 제출해주세요.');
        setPhase('error');
        return;
      }

      try {
        setPhase('calling');
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          let msg = '분석 실패';
          try {
            const data = await res.json();
            if (data?.error) msg = data.error;
          } catch {
            // ignore parse error
          }
          if (!cancelled) {
            setErrorMsg(msg);
            setPhase('error');
          }
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setPhase('diagnosing');
          // demo 응답은 즉시 완료, 실 응답도 동일 경로(결과 이미 도착)
          setIsDemo(data.demo === true);
          saveAnalyzeResult(data.result);
          clearSubmittedPayload();

          // demo: 즉시 전환. 실: 작업 이미 완료됐으므로 바로 전환.
          setPhase('done');
          router.push('/result');
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.');
          setPhase('error');
        }
      }
    }

    runAnalysis();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleRetry() {
    setErrorMsg(null);
    setPhase('calling');
    // useEffect 의존성을 트리거하지 않으므로 페이지 리로드
    window.location.reload();
  }

  const currentStepIdx = STEP_SEQUENCE.findIndex((s) => s.key === phase);
  const activeIdx = currentStepIdx < 0 ? 0 : currentStepIdx;

  return (
    <RequireAuth>
    <>
      <PageHeader />
      <div className="w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            진단 진행 중
          </h1>
          <StepIndicator current="processing" />
        </div>
        <p className="mb-6 text-ink-700">
          제출이 접수되었습니다. AI가 §6 가드레일 안에서 결과를 만들고 있습니다.
          {isDemo && (
            <span className="ml-2 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              데모 모드 (API 키 없음)
            </span>
          )}
        </p>

        <GuardrailLabel variant="general" className="mb-6" />

        {phase === 'error' ? (
          <div className="space-y-4">
            <ErrorState
              title="분석 중 오류가 발생했습니다"
              message={errorMsg ?? '알 수 없는 오류'}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
              >
                다시 시도
              </button>
              <Link
                href="/submit"
                className="rounded-xl border border-ink-200 px-5 py-3 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                처음으로
              </Link>
            </div>
          </div>
        ) : (
          <>
            <AnalysisStatusCard phase={phase} activeIdx={activeIdx} />

            <section className="mt-6 space-y-3">
              {STEP_SEQUENCE.map((s, idx) => (
                <Step
                  key={s.key}
                  index={idx}
                  label={s.label}
                  detail={s.detail}
                  state={
                    idx < activeIdx ? 'done' : idx === activeIdx ? 'current' : 'todo'
                  }
                />
              ))}
            </section>

            <p className="mt-6 text-xs text-ink-400">
              분석 중(보통 1분) — 완료되면 자동으로 결과 화면으로 이동합니다.
            </p>
          </>
        )}

        <div className="mt-10 flex items-center justify-between border-t border-ink-100 pt-6">
          <Link
            href="/consent"
            className="text-sm text-ink-500 hover:text-ink-900"
          >
            ← 동의로
          </Link>
        </div>
      </div>
    </>
    </RequireAuth>
  );
}

function AnalysisStatusCard({
  phase,
  activeIdx,
}: {
  phase: AnalysisPhase;
  activeIdx: number;
}) {
  const pct = Math.round(((activeIdx + 0.5) / STEP_SEQUENCE.length) * 100);
  const isDone = phase === 'done';

  const statusLabel: Record<AnalysisPhase, string> = {
    calling: '생기부 분석 중',
    diagnosing: '진단·면접 준비 생성 중',
    done: '결과 도착',
    error: '오류',
  };

  return (
    <div
      className={cn(
        'rounded-2xl border p-5',
        isDone
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-brand-200 bg-brand-50/40'
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {!isDone && (
          <span
            className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600"
            aria-hidden
          />
        )}
        <p
          className={cn(
            'text-base font-semibold',
            isDone ? 'text-emerald-700' : 'text-brand-700'
          )}
        >
          {statusLabel[phase]}
        </p>
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/70"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isDone ? 100 : pct}
      >
        <div
          className={cn(
            'h-full transition-all duration-700',
            isDone ? 'bg-emerald-500' : 'bg-brand-500'
          )}
          style={{ width: `${isDone ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}

function Step({
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
