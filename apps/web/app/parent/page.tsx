'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatStandingLabel } from '@pullim/shared';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/components/auth/auth-provider';
import { loadSubmittedProfile, type SubmittedProfile } from '@/lib/submitted-profile';
import { loadAnalyzeResult, toResultViewModel, type ResultViewModel } from '@/lib/result-view';
import { parkJunho } from '@/lib/mock/park-junho';

// 정의 §6.3 가드: 자녀 생기부 원문·AI 결과물 전문은 학부모에게 미노출 — 진행 요약만.
// 로그인 + 자녀 진단 결과가 있으면 실제 요약을, 없으면 예시(데모) 미리보기를 명시해 보여준다.
// (요약은 비-PII 진행/역량 수준이며 면접·진단 본문은 '학생 화면 전용'으로 분리 유지.)

export default function ParentReportPage() {
  const { user, status } = useAuth();
  const [profile, setProfile] = useState<SubmittedProfile | null>(null);
  const [vm, setVm] = useState<ResultViewModel | null>(null);

  // ⚠️ 인증된 사용자일 때만 실제 자녀 데이터를 읽는다 — 로그아웃/공유 탭에서 이전 사용자의
  //    진행 요약이 노출되는 것을 막는다(codex #51 리뷰). 미인증이면 예시(데모) 미리보기만.
  useEffect(() => {
    if (status !== 'authed') {
      setProfile(null);
      setVm(null);
      return;
    }
    setProfile(loadSubmittedProfile());
    const r = loadAnalyzeResult();
    setVm(r ? toResultViewModel(r) : null);
  }, [status]);

  const hasReal = !!profile && !!vm;
  const competencies = vm
    ? Array.from(new Set(vm.diagnosis.map((d) => d.competencyLabelText)))
    : [];

  const studentLabel = hasReal
    ? `${user?.displayName ?? '자녀'}${profile ? ` · ${formatStandingLabel(profile)}` : ''}`
    : `${parkJunho.identity.displayLabel} (예시·데모)`;
  const weekOf = hasReal ? '이번 주' : `${parkJunho.parentReport.weekOf} (예시)`;
  const progress = hasReal
    ? 'AI 1차 결과 도착 · 학생 검토 중'
    : parkJunho.parentReport.progress;
  const nextWeekPlan = hasReal
    ? '면접 예상 질문 중 어려운 항목에 대해 본인 답변을 정리할 예정입니다.'
    : parkJunho.parentReport.nextWeekPlan;
  const highlights = hasReal
    ? [
        '면접 준비 팩·생기부 진단 가이드·부족 활동 보완안이 도착했습니다.',
        '학생부 종합 전형 평가 기준에서 강·약점을 확인하는 단계입니다.',
        competencies.length > 0
          ? `분석된 평가 역량: ${competencies.join(' · ')}.`
          : '상세 진단은 학생 화면에서 확인할 수 있습니다.',
      ]
    : parkJunho.parentReport.summaryHighlights;

  return (
    <>
      <PageHeader />
      <div className="w-full max-w-3xl px-6 py-10">
        <div className="mb-6">
          <p className="text-sm text-ink-500">학부모 주간 리포트</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900">
            자녀 진행 요약
          </h1>
          <p className="mt-2 text-ink-700">
            {weekOf} 주간 · {studentLabel}
          </p>
        </div>

        <PrivacyNote />

        {!hasReal && (
          <aside
            role="note"
            className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-sm leading-relaxed text-ink-700"
          >
            아직 자녀의 진단 결과가 없어 <strong className="text-ink-900">예시 데이터</strong>로
            화면 형태만 보여드립니다. 자녀가 생기부를 제출·진단하면 이 자리에 실제 주간 요약이 표시됩니다.
          </aside>
        )}

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card title="이번 주 진행 상태" emphasis>
            <p className="text-base font-semibold text-brand-700">{progress}</p>
          </Card>
          <Card title="다음 주 계획">
            <p className="text-sm leading-relaxed text-ink-700">{nextWeekPlan}</p>
          </Card>
        </section>

        <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-base font-semibold text-ink-900">이번 주 요약 (3가지)</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-ink-700">
            {highlights.map((line, idx) => (
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
            {['학생부 종합 전형 면접 준비 팩', '생기부 진단 가이드', '부족 활동 보완안'].map(
              (t) => (
                <li key={t} className="flex items-center justify-between">
                  <span>{t}</span>
                  <span className="text-xs font-medium text-brand-700">학생 화면 전용</span>
                </li>
              )
            )}
          </ul>
        </section>

        <div className="mt-10 flex items-center justify-between border-t border-ink-100 pt-6">
          <Link href="/" className="text-sm text-ink-500 hover:text-ink-900">
            ← 처음으로
          </Link>
          <span className="text-xs text-ink-500">
            주간 리포트는 매주 일요일 이메일로도 발송될 예정입니다.
          </span>
        </div>
      </div>
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
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
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
        본 리포트는 자녀의 *진행 요약*만 제공합니다. 자녀의 생기부 원문이나 AI 결과물의 본문은
        학부모에게 노출되지 않습니다. 학생과 학부모의 권한이 분리되어 있습니다.
      </p>
    </aside>
  );
}
