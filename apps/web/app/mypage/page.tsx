'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/auth/auth-provider';
import { auth, type DiagnosisSummary } from '@/lib/auth';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';

// ── 날짜 포맷 헬퍼 ───────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── 회원탈퇴 확인 모달 ────────────────────────────────────────────────────────
function DeleteAccountModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-6 shadow-xl">
        <h2 id="delete-modal-title" className="text-lg font-bold text-ink-900">
          정말 탈퇴하시겠어요?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          계정과 진단 이력이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-xl border border-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-ink-200 disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            {isPending ? '처리 중…' : '탈퇴'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 마이페이지 내용 ───────────────────────────────────────────────────────────
function MyPageContent() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [diagnoses, setDiagnoses] = useState<DiagnosisSummary[]>([]);
  const [diagLoading, setDiagLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLogoutPending, startLogoutTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    auth.listDiagnoses().then((list) => {
      if (!cancelled) { setDiagnoses(list); setDiagLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  function handleLogout() {
    startLogoutTransition(async () => {
      await logout();
      router.push('/');
    });
  }

  function handleDeleteConfirm() {
    startDeleteTransition(async () => {
      await auth.deleteAccount();
      router.push('/');
    });
  }

  if (!user) return null; // RequireAuth 보장 하에 도달 안 함

  // 연령대 레이블
  const ageBandLabel =
    user.ageBand === 'under14' ? '14세 미만' : user.ageBand === 'over14' ? '14세 이상' : '미확인';

  return (
    <main className="w-full max-w-2xl px-6 pb-16 pt-10">
      {/* 페이지 제목 */}
      <h1 className="text-3xl font-bold tracking-tight text-ink-900">마이페이지</h1>

      {/* ── 프로필 카드 ─────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
          프로필
        </h2>
        <div className="rounded-2xl border border-ink-100 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-ink-900">{user.displayName}</p>
              <p className="mt-0.5 text-sm text-ink-500">{user.email}</p>
            </div>
            {user.isMinor && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                  'bg-brand-50 text-brand-700'
                )}
              >
                미성년자
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-md bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600">
              연령대: {ageBandLabel}
            </span>
            {user.isMinor && (
              <span
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium',
                  user.guardianConsent === 'approved'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                )}
              >
                {user.guardianConsent === 'approved'
                  ? '✓ 보호자 동의 완료'
                  : '보호자 동의 대기'}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── 요금제 카드 ─────────────────────────────────────────────────────── */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
          요금제
        </h2>
        <div className="rounded-2xl border border-ink-100 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-ink-900 capitalize">
                {user.package} · {user.tier}
              </p>
              <p className="mt-0.5 text-sm text-ink-500">현재 사용 중인 플랜</p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {user.tier === 'free' ? '무료' : user.tier}
            </span>
          </div>
          <p className="mt-4 rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3 text-sm leading-relaxed text-ink-500">
            요금제 변경은 곧 제공될 예정입니다. 베타 기간 동안 무료로 이용 가능합니다.
          </p>
        </div>
      </section>

      {/* ── 진단 이력 ───────────────────────────────────────────────────────── */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
          진단 이력
        </h2>

        {diagLoading ? (
          <p className="py-8 text-sm text-ink-400">불러오는 중…</p>
        ) : diagnoses.length === 0 ? (
          <EmptyState
            title="아직 진단이 없어요"
            description="생기부를 제출하면 24시간 내 진단 결과를 받아볼 수 있습니다."
            action={
              <Link
                href="/submit"
                className="inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                생기부 제출하기
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {diagnoses.map((dx) => (
              <li
                key={dx.id}
                className="rounded-2xl border border-ink-100 bg-white p-5 transition hover:border-brand-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        {dx.track}
                      </span>
                      <span className="text-xs text-ink-400">{formatDate(dx.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-700">{dx.summary}</p>
                  </div>
                  <Link
                    href="/result"
                    className="shrink-0 rounded-xl border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
                  >
                    다시 보기
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 계정 관리 ───────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
          계정 관리
        </h2>
        <div className="rounded-2xl border border-ink-100 bg-white p-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLogoutPending}
              className="rounded-xl border border-ink-100 px-5 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-ink-200 hover:bg-ink-50 disabled:opacity-60"
            >
              {isLogoutPending ? '로그아웃 중…' : '로그아웃'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="rounded-xl border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
            >
              회원탈퇴
            </button>
          </div>
        </div>
      </section>

      {/* 회원탈퇴 확인 모달 */}
      {showDeleteModal && (
        <DeleteAccountModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
          isPending={isDeletePending}
        />
      )}
    </main>
  );
}

// ── 페이지 export ─────────────────────────────────────────────────────────────
export default function MyPage() {
  return (
    <RequireAuth>
      <MyPageContent />
    </RequireAuth>
  );
}
