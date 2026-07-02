'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { GuardrailLabel } from '@/components/guardrail-label';
import { parkJunho } from '@/lib/mock/park-junho';
import { cn } from '@/lib/utils';
import { RequireAuth } from '@/components/auth/require-auth';
import { competencyLabel, formatStandingLabel, INTERVIEW_FORMAT_LABEL, cohortFromGrade, type CohortResult } from '@pullim/shared';
import { loadSubmittedProfile, type SubmittedProfile } from '@/lib/submitted-profile';
import { toResultViewModel, type ResultViewModel } from '@/lib/result-view';
import { getDiagnosis, toAnalyzeResult, loadLastResultId, fetchLatestDiagnosis, saveLastResultId, type DiagnosisDto } from '@/lib/admissions-api';
import { SelfAnswer } from '@/components/result/self-answer';
import { ResultActions } from '@/components/result/result-actions';
import type { Roadmap, RoadmapPhase } from '@pullim/engine';
import type { FitAssessment } from '@/lib/fit';

const COHORT_LABEL: Record<CohortResult['system'], string> = {
  '2027_old': '2027 대입 · 구체제',
  '2028_new': '2028 대입 · 신체제',
  '2029_new': '2029 대입 · 신체제',
};

const RECORD_AREA_LABEL: Record<string, string> = {
  SETUK: '교과 세특',
  CREATIVE_REGULAR: '정규 창의적 체험활동',
  BEHAVIOR: '행동 특성 및 종합의견',
};

const FIT_LEVEL_STYLE: Record<'강함' | '적정' | '보완필요', string> = {
  강함: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  적정: 'border-amber-200 bg-amber-50 text-amber-700',
  보완필요: 'border-red-200 bg-red-50 text-red-700',
};

type Tab = 'interview' | 'diagnosis' | 'improvements';

const tabs: { id: Tab; label: string }[] = [
  { id: 'interview', label: '학생부 종합 전형 면접 준비 팩' },
  { id: 'diagnosis', label: '생기부 진단 가이드' },
  { id: 'improvements', label: '부족 활동 보완안' },
];

export default function ResultPage() {
  const [tab, setTab] = useState<Tab>('interview');
  const [profile, setProfile] = useState<SubmittedProfile | null>(null);
  const [viewModel, setViewModel] = useState<ResultViewModel | null>(null);
  const [resultIsDemo, setResultIsDemo] = useState(false);
  // 서버 진단이 아직 완료 전/실패인 상태 — 데모로 가리지 않고 명시 분기(§6 정직).
  const [serverState, setServerState] = useState<'in_progress' | 'failed' | 'unavailable' | null>(null);

  useEffect(() => {
    setProfile(loadSubmittedProfile());

    // 정본 = admissions 백엔드(diagnosis_results) — 마지막 진단 id 로 서버 재조회(ADR-058).
    // 로컬 id 유실(프라이빗 모드) 시 서버 이력 최신 1건으로 복구. pending/processing·failed 는
    // 데모로 가리지 않고 명시 분기(§6 정직 — 진행 안내/오류 노출). 레거시 세션 결과는 하위호환 폴백.
    let cancelled = false;
    async function loadFromServer() {
      let dto: DiagnosisDto | null = null;
      const id = loadLastResultId();
      if (id) {
        try {
          dto = await getDiagnosis(id);
        } catch {
          // 조회 실패(만료·파기) — 서버 이력 복구 시도.
        }
      }
      let fetchFailed = false;
      if (!dto) {
        try {
          dto = await fetchLatestDiagnosis();
          if (dto) saveLastResultId(dto.id);
        } catch {
          // 이력 조회 자체가 실패(일시 500·네트워크·인증 갱신) — 데모로 가리지 않고 명시 표시.
          fetchFailed = true;
        }
      }
      if (cancelled) return;
      if (!dto && fetchFailed) {
        setServerState('unavailable');
        return;
      }

      if (dto) {
        if (dto.status === 'done') {
          const result = toAnalyzeResult(dto);
          if (result) {
            setViewModel(toResultViewModel(result));
            setResultIsDemo(false);
            setServerState(null);
            return;
          }
          // done 인데 본문 손상(부분 영속) — 오래된 레거시/데모로 가리지 않고 실패로 노출(재제출 유도).
          setServerState('failed');
          return;
        } else if (dto.status === 'pending' || dto.status === 'processing') {
          setServerState('in_progress');
          return;
        } else if (dto.status === 'failed') {
          setServerState('failed');
          return;
        }
      }
      // 레거시 세션 결과 폴백은 은퇴 — 현재 사용자·진단과 연결되지 않은 값이라 네트워크/권한
      // 오류 시 타인·과거 결과가 재렌더될 수 있다(서버가 유일 정본, 없으면 데모 고지).
    }
    loadFromServer();
    return () => {
      cancelled = true;
    };
  }, []);

  // 데모 고지: 실 결과가 전혀 없거나(미제출), 키 없이 생성된 mock 결과일 때.
  // 후자는 viewModel이 있어도 본문이 예시이므로 반드시 고지해야 함(§6 정직).
  const isDemo = !viewModel || resultIsDemo;

  return (
    <RequireAuth>
    <>
      <PageHeader />
      <div className="w-full max-w-4xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            진단 결과
          </h1>
          <StepIndicator current="result" />
        </div>
        <p className={cn('text-ink-700', profile ? 'mb-2' : 'mb-6')}>
          {profile
            ? `${formatStandingLabel(profile)} · 1차 진단 결과`
            : '예시 학생 (데모) · 고3 2학기 · 이공 · 1차 진단 결과'}
        </p>
        {profile && (() => {
          const cohort = cohortFromGrade(profile.grade);
          const label = COHORT_LABEL[cohort.system] + (cohort.emphasizeSetuk ? ' · 정성평가(세특·창체) 반영' : '');
          return (
            <p className="mb-2">
              <span className="inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                {label}
              </span>
            </p>
          );
        })()}
        {profile && profile.targetUniversities.length > 0 && (
          <p className="mb-6 text-sm text-ink-500">
            목표:{' '}
            {profile.targetUniversities
              .map((u, i) => `${i + 1}순위 ${u.name}${u.department ? ` ${u.department}` : ''}`)
              .join(' · ')}
          </p>
        )}

        {serverState === 'in_progress' && (
          <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
            <p className="text-sm font-semibold text-brand-800">분석이 아직 진행 중입니다</p>
            <p className="mt-1 text-sm text-ink-700">
              AI 진단이 완료되면 이 화면에서 결과를 볼 수 있어요(보통 1–3분).
            </p>
            <Link
              href="/processing"
              className="mt-3 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              진행 상태 보기
            </Link>
          </div>
        )}
        {serverState === 'unavailable' && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
            <p className="text-sm font-semibold text-amber-800">결과를 불러오지 못했어요</p>
            <p className="mt-1 text-sm text-ink-700">
              일시적인 오류로 진단 결과를 확인할 수 없습니다. 잠시 후 새로고침해주세요 — 결과는 사라지지 않습니다.
            </p>
          </div>
        )}
        {serverState === 'failed' && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/60 p-5">
            <p className="text-sm font-semibold text-red-800">분석에 실패했어요</p>
            <p className="mt-1 text-sm text-ink-700">
              일시적인 오류일 수 있어요. 생기부를 다시 제출하면 새로 분석합니다.
            </p>
            <Link
              href="/submit"
              className="mt-3 inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              다시 제출하기
            </Link>
          </div>
        )}
        {serverState !== null ? null : (
        <>
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

        {isDemo && (
          <aside
            role="note"
            className="mb-6 rounded-2xl border border-ink-100 bg-ink-100/50 px-4 py-3 text-sm leading-relaxed text-ink-600"
          >
            아래 면접·진단·보완{' '}
            <strong className="text-ink-900">본문은 예시 결과(데모)</strong>입니다. 실제 개인화
            결과는 출시 버전에서 제공됩니다.
          </aside>
        )}

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

        {tab === 'interview' && (
          viewModel
            ? <InterviewPanelReal questions={viewModel.interview} />
            : <InterviewPanel />
        )}
        {tab === 'diagnosis' && (
          viewModel
            ? <DiagnosisPanelReal criteria={viewModel.diagnosis} />
            : <DiagnosisPanel />
        )}
        {tab === 'improvements' && (
          viewModel
            ? <ImprovementsPanelReal items={viewModel.improvements} />
            : <ImprovementsPanel />
        )}

        {/* 로드맵 (실 데이터 있을 때만) */}
        {viewModel?.roadmap && (
          <RoadmapSection roadmap={viewModel.roadmap} />
        )}

        {/* 적합도 (실 데이터 있을 때만, 합격%·점수 없음) */}
        {viewModel?.fit && (
          <FitSection fit={viewModel.fit} />
        )}

        <div className="mt-10 mb-6">
          <p className="mb-3 text-sm font-semibold text-ink-700">결과 저장·공유</p>
          <ResultActions
            track={profile ? formatStandingLabel(profile) : '공학계열'}
            summary="면접 준비 팩 · 생기부 진단 가이드 · 부족 활동 보완안"
          />
        </div>
        </>
        )}

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
      </div>
    </>
    </RequireAuth>
  );
}

// ── 실데이터 패널들 ─────────────────────────────────────────────────────────

function InterviewPanelReal({ questions }: { questions: ResultViewModel['interview'] }) {
  if (questions.length === 0) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-ink-500">면접 준비 팩 데이터가 없습니다.</p>
      </section>
    );
  }
  return (
    <section className="space-y-4">
      <p className="text-sm text-ink-500">
        면접 예상 질문 {questions.length}건 — 답변 방향과 근거 기반
      </p>
      {questions.map((q, idx) => (
        <article
          key={idx}
          className="rounded-2xl border border-ink-100 bg-white p-5"
        >
          <header className="flex flex-wrap items-baseline gap-2">
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
              <dd className="mt-1 text-ink-900">{q.answerDirection}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                근거 생기부 항목
              </dt>
              <dd className="mt-1">
                <span className="inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {q.basisSection}
                </span>
                <p className="mt-1 text-ink-700">{q.basisQuote}</p>
              </dd>
            </div>
            {q.followups.length > 0 && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  꼬리질문 대비
                </dt>
                <dd className="mt-1">
                  <ul className="space-y-1">
                    {q.followups.map((f, fi) => (
                      <li key={fi} className="flex gap-2 text-ink-700">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            <SelfAnswer qid={`interview-${idx}`} />
          </dl>
        </article>
      ))}
    </section>
  );
}

function DiagnosisPanelReal({ criteria }: { criteria: ResultViewModel['diagnosis'] }) {
  const flagStyle = {
    strength: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    weakness: 'border-amber-200 bg-amber-50 text-amber-700',
  } as const;

  return (
    <section className="space-y-4">
      {criteria.map((c) => (
        <article
          key={c.competency}
          className="rounded-2xl border border-ink-100 bg-white p-5"
        >
          <h3 className="text-base font-semibold text-ink-900">
            {c.competencyLabelText}
          </h3>
          <p className="mt-1 text-xs text-ink-500">{c.mapping}</p>

          <div className="mt-4 space-y-3">
            {c.strength && (
              <div className={cn('rounded-xl border p-3', flagStyle.strength)}>
                <p className="text-xs font-semibold mb-1">◎ 강점</p>
                <p className="text-sm leading-relaxed">{c.strength}</p>
              </div>
            )}
            {c.weakness && (
              <div className={cn('rounded-xl border p-3', flagStyle.weakness)}>
                <p className="text-xs font-semibold mb-1">△ 보완</p>
                <p className="text-sm leading-relaxed">{c.weakness}</p>
              </div>
            )}
          </div>

          {c.evidence.length > 0 && (
            <div className="mt-4 border-t border-ink-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">
                생기부 근거
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {c.evidence.map((e, ei) => (
                  <li
                    key={ei}
                    className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                    title={e.quote}
                  >
                    {e.section}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function ImprovementsPanelReal({ items }: { items: ResultViewModel['improvements'] }) {
  if (items.length === 0) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-ink-500">이 프로필에 해당하는 보완 처방이 없습니다.</p>
      </section>
    );
  }
  return (
    <section className="space-y-4">
      <p className="text-sm text-ink-500">
        게이트 통과 합법 처방 {items.length}건 — 대입 반영 영역 기반
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item, idx) => (
          <article
            key={idx}
            className="rounded-2xl border border-ink-100 bg-white p-5"
          >
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {RECORD_AREA_LABEL[item.recordArea] ?? item.recordArea}
              </span>
              <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">
                {competencyLabel[item.competency]}
              </span>
            </div>
            <p className="text-sm font-semibold text-ink-900">{item.text}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{item.rationale}</p>
            <div className="mt-3 rounded-md bg-brand-50 px-2 py-1 text-xs text-brand-700">
              <span className="font-medium">{item.evidence.section}</span>
              {item.evidence.quote && (
                <span className="ml-1 text-brand-500">— {item.evidence.quote}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ── 로드맵 섹션 ──────────────────────────────────────────────────────────────

function RoadmapSection({ roadmap }: { roadmap: Roadmap }) {
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-lg font-bold text-ink-900">입시 로드맵</h2>
      <p className="mb-4 text-sm text-ink-500">{roadmap.note}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roadmap.phases.map((phase: RoadmapPhase) => (
          <div
            key={phase.key}
            className={cn(
              'rounded-2xl border p-4',
              phase.active
                ? 'border-brand-300 bg-brand-50'
                : 'border-ink-100 bg-white'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={cn(
                'rounded-md px-2 py-0.5 text-xs font-semibold',
                phase.active
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-ink-100 text-ink-600'
              )}>
                {phase.label}
              </span>
              <span className="text-xs text-ink-400">{phase.window}</span>
            </div>
            <ul className="space-y-1">
              {phase.focus.map((f, fi) => (
                <li key={fi} className="flex gap-2 text-xs leading-relaxed text-ink-700">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 적합도 섹션 ──────────────────────────────────────────────────────────────

function FitSection({ fit }: { fit: FitAssessment }) {
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-lg font-bold text-ink-900">전형 적합도</h2>
      <p className="mb-1 text-sm text-ink-500">{fit.consistencyNote}</p>
      <p className="mb-4 text-xs text-ink-400">{fit.caveat}</p>

      {/* 역량별 정성 수준 (합격%·점수 없음) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-6">
        {fit.competencyFit.map((cf) => (
          <div
            key={cf.key}
            className={cn(
              'rounded-2xl border p-4',
              FIT_LEVEL_STYLE[cf.level]
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{competencyLabel[cf.key.toLowerCase() as keyof typeof competencyLabel] ?? cf.key}</span>
              <span className="rounded-full border border-current px-2 py-0.5 text-xs font-semibold">
                {cf.level}
              </span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">{cf.reason}</p>
          </div>
        ))}
      </div>

      {/* 권장 과목 */}
      {fit.recommendedSubjects.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
            권장 과목
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fit.recommendedSubjects.map((s) => (
              <span
                key={s}
                className="rounded-full bg-ink-100 px-3 py-0.5 text-xs font-medium text-ink-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 목표 대학별 노트 */}
      {fit.universityFit && fit.universityFit.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
            목표 대학별 평가기준
          </p>
          <div className="space-y-3">
            {fit.universityFit.map((uf, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-ink-100 bg-white p-4"
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink-900">
                    {uf.matched ? uf.name : uf.input}
                  </span>
                  {!uf.matched && (
                    <span className="text-xs text-ink-400">미수록</span>
                  )}
                </div>
                {uf.matched && uf.evaluationFraming && (
                  <p className="text-sm text-ink-700 mb-1">{uf.evaluationFraming}</p>
                )}
                {uf.matched && uf.evaluationItems && (
                  <ul className="flex flex-wrap gap-1 mb-2">
                    {uf.evaluationItems.map((item) => (
                      <li
                        key={item}
                        className="rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-600"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-ink-400">{uf.note}</p>
                {uf.matched && uf.source && (
                  <p className="mt-1 text-xs text-ink-300">출처: {uf.source}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── 목 폴백 패널들 (기존 코드 그대로) ─────────────────────────────────────────

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
          <header className="flex flex-wrap items-baseline gap-2">
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              Q{idx + 1}
            </span>
            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">
              {INTERVIEW_FORMAT_LABEL[q.format]}
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
                {q.evidence.length > 0 ? (
                  <ul className="space-y-1">
                    {q.evidence.map((e) => (
                      <li key={e} className="flex gap-2 text-ink-700">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-500">
                    {(q.format as string) === 'mmi' ? '(가상 상황 면접 — 생기부 근거 없음)' : '(제시문 면접 — 생기부 근거 없음)'}
                  </p>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                꼬리질문 대비
              </dt>
              <dd className="mt-1 text-ink-700">{q.followUp}</dd>
            </div>
            <SelfAnswer qid={`interview-${idx}`} />
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
