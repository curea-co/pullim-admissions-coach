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
import { studentProfileSchema } from '@pullim/shared';
import { clearAnalyzeResult } from '@/lib/result-view';
import {
  submitAndDiagnose,
  getDiagnosis,
  saveLastResultId,
  loadLastResultId,
  fetchLatestDiagnosis,
} from '@/lib/admissions-api';
import type { ApiError } from '@/lib/api';

// 분석 진행 — admissions 백엔드(ADR-058): 제출 영속→동의 적재→진단 enqueue→워커 완료 폴링.
// 결과 본문은 서버(diagnosis_results)가 정본 — 세션엔 진단 id 만 남긴다.

type AnalysisPhase = 'submitting' | 'analyzing' | 'done' | 'error';

const STEP_SEQUENCE: { key: AnalysisPhase; label: string; detail: string }[] = [
  { key: 'submitting', label: '제출 접수', detail: '생기부를 안전하게 저장하고 동의를 기록합니다' },
  { key: 'analyzing', label: '분석 중', detail: 'AI가 §6 가드레일 준수로 분석 중 (보통 1–3분)' },
  { key: 'done', label: '결과 도착', detail: '결과 화면을 불러옵니다' },
];

/** 폴링 간격·상한 — opus 3콜(진단·처방·면접) 비동기 워커라 넉넉히 잡는다. */
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_MS = 8 * 60 * 1000;

export default function ProcessingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<AnalysisPhase>('submitting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function pollUntilDone(diagnosisId: string): Promise<void> {
      const deadline = Date.now() + POLL_MAX_MS;
      while (!cancelled && Date.now() < deadline) {
        const dto = await getDiagnosis(diagnosisId);
        if (cancelled) return;
        if (dto.status === 'done') {
          setPhase('done');
          router.push('/result');
          return;
        }
        if (dto.status === 'failed') {
          throw new Error('분석에 실패했어요. 처음부터 다시 제출해주세요.');
        }
        await sleep(POLL_INTERVAL_MS);
      }
      if (!cancelled) {
        throw new Error(
          '분석이 예상보다 오래 걸리고 있어요. 완료되는 대로 진단 결과 화면에서 확인할 수 있습니다.'
        );
      }
    }

    async function runAnalysis() {
      const payload = loadSubmittedPayload();
      if (!payload) {
        // payload 없음 — 진행 중이던 진단이 있으면 폴링 재개(새로고침 복원).
        // 로컬 id 유실(프라이빗 모드)이어도 서버 이력에서 최신 진단으로 복구한다.
        // 최신 이력을 우선 신뢰(낡은 로컬 포인터가 과거 진단을 현재 제출로 오인하는 것 차단) —
        // 이력 조회 실패 시에만 로컬 id 폴백.
        let pendingId: string | null = null;
        {
          try {
            const latest = await fetchLatestDiagnosis();
            if (latest) {
              if (latest.status === 'done') {
                // 이미 완료 — 포인터 재저장 후 결과로.
                saveLastResultId(latest.id);
                setPhase('done');
                router.push('/result');
                return;
              }
              if (latest.status === 'failed') {
                setErrorMsg('분석에 실패했어요. 처음부터 다시 제출해주세요.');
                setPhase('error');
                return;
              }
              pendingId = latest.id;
            }
          } catch {
            // 이력 조회 실패(일시 장애·인증 갱신) — 로컬 id 폴백. 그것도 없으면 재제출 대신
            // 재시도 안내(제출이 이미 접수됐을 수 있음 — 중복 submission 방지).
            pendingId = loadLastResultId();
            if (!pendingId) {
              setErrorMsg(
                '분석 상태를 확인하지 못했어요(일시적인 오류). 잠시 후 새로고침해주세요 — 이미 접수된 제출은 다시 제출할 필요가 없습니다.'
              );
              setPhase('error');
              return;
            }
          }
        }
        if (pendingId) {
          try {
            setPhase('analyzing');
            await pollUntilDone(pendingId);
          } catch (err) {
            if (!cancelled) {
              setErrorMsg(err instanceof Error ? err.message : '분석 상태를 확인하지 못했습니다.');
              setPhase('error');
            }
          }
          return;
        }
        setErrorMsg('제출 데이터를 찾을 수 없습니다. 처음부터 다시 제출해주세요.');
        setPhase('error');
        return;
      }

      // 새 분석 시작 — 이전 레거시 세션 결과를 비워 /result 오표시를 막는다.
      clearAnalyzeResult();

      // 세션 payload 를 스키마로 재검증(변조·부분 저장 방어 — 서버도 DTO 로 재검증).
      const parsed = studentProfileSchema.safeParse(payload);
      if (!parsed.success) {
        setErrorMsg('제출 데이터가 올바르지 않습니다. 처음부터 다시 제출해주세요.');
        setPhase('error');
        return;
      }

      try {
        setPhase('submitting');
        // 제출 영속(서버가 저장 전 마스킹 재적용) → 동의 append → 진단 enqueue(멱등 jobId).
        const diagnosisId = await submitAndDiagnose(parsed.data);
        // id 포인터를 먼저 저장 시도한 뒤 민감 본문을 파기한다 — 저장이 실패해도(프라이빗 모드)
        // 서버가 정본이므로 파기는 진행하고, /result·재진입은 서버 이력(fetchLatestDiagnosis)로 복구된다.
        saveLastResultId(diagnosisId);
        clearSubmittedPayload();

        if (cancelled) return;
        setPhase('analyzing');
        await pollUntilDone(diagnosisId);
      } catch (err) {
        if (cancelled) return;
        const e = err as ApiError;
        setErrorMsg(
          e?.message ?? (err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.')
        );
        setPhase('error');
      }
    }

    runAnalysis();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleRetry() {
    setErrorMsg(null);
    setPhase('submitting');
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
              분석 중(보통 1–3분) — 완료되면 자동으로 결과 화면으로 이동합니다. 이 화면을 닫아도 분석은 계속됩니다.
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
    submitting: '제출 접수',
    analyzing: '분석 중',
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
