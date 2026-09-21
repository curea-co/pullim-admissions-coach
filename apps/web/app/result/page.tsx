'use client';

// 진단 **내역 목록** — /result. 한 건을 고르면 상세(/result/[id])로 간다.
//
// 이 화면이 생긴 이유: 진단은 여러 번 받을 수 있는데(재제출), 예전에는 결과 화면이 늘 "최신 1건"
// 만 보여줘서 지난 진단에 닿을 길이 없었다(마이페이지의 이력 목록이 그 역할을 떠맡고 있었다).
// 목록 → 상세가 이 도메인의 자연스러운 흐름이고, 계정 화면이 진단 데이터를 들고 있을 이유는 없다.
//
// 로그인 + admissions 이용권 두 겹의 게이트 뒤에 있다(정책 v2.0 §7-3). 상세와 같은 이유로,
// 조회 effect 는 게이트 **하위 자식**에 둔다 — 게이트는 JSX 렌더만 막고 마운트 effect 는 막지
// 못하므로, 페이지 자신에 두면 미보유 사용자의 deep-link 가 API 를 쏘고 그 403 이 화면에 굳는다
// (Codex #59 · lib/result-entitlement.test.tsx 가 이 구조를 고정).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
// typedRoutes 가 켜져 있어 동적 경로는 리터럴로 검증되지 않는다 — `/result/[id]` 는 실재하는
// 라우트이므로 Route 로 단언한다(오타는 아래 href 한 곳에만 있어 눈으로 잡힌다).
import type { Route } from 'next';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { EmptyState } from '@/components/empty-state';
import { SkeletonCard } from '@/components/loading-skeleton';
import { RequireAuth } from '@/components/auth/require-auth';
import { RequireAdmissionsAccess } from '@/components/auth/require-admissions-access';
import { listDiagnoses, type DiagnosisDto } from '@/lib/admissions-api';
import { cn } from '@/lib/utils';

type ListState = 'loading' | 'ready' | 'empty' | 'unavailable';

/** 상태 배지 — 진행중·실패도 감추지 않는다(§6 정직). 완료만 보여주면 "제출했는데 없다"가 된다. */
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  done: { label: '완료', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  processing: { label: '분석 중', className: 'border-brand-200 bg-brand-50 text-brand-700' },
  pending: { label: '분석 대기', className: 'border-brand-200 bg-brand-50 text-brand-700' },
  failed: { label: '실패', className: 'border-red-200 bg-red-50 text-red-700' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '날짜 미상';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ResultListPage() {
  return (
    <RequireAuth>
      <RequireAdmissionsAccess>
        <ResultList />
      </RequireAdmissionsAccess>
    </RequireAuth>
  );
}

function ResultList() {
  const router = useRouter();
  const [state, setState] = useState<ListState>('loading');
  const [rows, setRows] = useState<DiagnosisDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list: DiagnosisDto[];
      try {
        list = await listDiagnoses();
      } catch {
        if (!cancelled) setState('unavailable');
        return;
      }
      if (cancelled) return;
      // 서버 정렬에 기대지 않고 최신순을 한 번 더 보장한다.
      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRows(sorted);

      // ⌘K 팔레트의 탭 딥링크(`/result?tab=diagnosis` 등)는 상세 화면의 파라미터다. 목록이
      // 생기기 전에 만들어진 링크라 id 가 없으므로, **최신 진단 상세**로 넘겨 기존 동작을 지킨다.
      // (팔레트 인덱스를 그대로 두는 대신 여기서 흡수한다 — 링크는 밖에도 퍼져 있을 수 있다.)
      let tab: string | null = null;
      try {
        tab = new URLSearchParams(window.location.search).get('tab');
      } catch {
        tab = null;
      }
      if (tab && sorted[0]) {
        router.replace(`/result/${sorted[0].id}?tab=${encodeURIComponent(tab)}` as Route);
        return;
      }
      setState(sorted.length > 0 ? 'ready' : 'empty');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      <PageHeader />
      <div className="w-full max-w-4xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">진단 결과</h1>
          <StepIndicator current="result" />
        </div>
        <p className="mb-6 text-ink-700">지금까지 받은 진단 내역이에요. 하나를 골라 결과를 확인하세요.</p>

        {state === 'loading' && (
          <div className="space-y-3" role="status" aria-live="polite">
            <span className="sr-only">진단 내역을 불러오는 중입니다</span>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {state === 'unavailable' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
            <p className="text-sm font-semibold text-amber-800">내역을 불러오지 못했어요</p>
            <p className="mt-1 text-sm text-ink-700">
              일시적인 오류일 수 있어요. 잠시 후 새로고침해주세요 — 결과는 사라지지 않습니다.
            </p>
          </div>
        )}

        {state === 'empty' && (
          <EmptyState
            title="아직 제출한 진단이 없어요"
            description="생기부를 제출하면 면접 준비 팩 · 진단 가이드 · 보완안을 여기에서 볼 수 있어요."
            action={
              <Link
                href="/submit"
                className="inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                생기부 제출하기
              </Link>
            }
          />
        )}

        {state === 'ready' && (
          <ul className="space-y-3">
            {rows.map((r) => {
              const badge = STATUS_BADGE[r.status] ?? {
                label: r.status,
                className: 'border-ink-100 bg-ink-50 text-ink-600',
              };
              return (
                <li key={r.id}>
                  <Link
                    href={`/result/${r.id}` as Route}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm"
                  >
                    <div>
                      <p className="text-base font-semibold text-ink-900">
                        {formatDate(r.createdAt)} 진단
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        면접 준비 팩 · 생기부 진단 가이드 · 부족 활동 보완안
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-10 border-t border-ink-100 pt-6">
          <Link href="/submit" className="text-sm text-ink-500 hover:text-ink-900">
            + 새 생기부 제출하기
          </Link>
        </div>
      </div>
    </>
  );
}
