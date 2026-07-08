'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/auth/auth-provider';
import { auth, isPullimAuth } from '@/lib/auth';
import { hasAdmissionsAccess } from '@/lib/admissions-api';
import { listDiagnoses, type SavedDiagnosis } from '@/lib/result-store';
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
  const [diagnoses, setDiagnoses] = useState<SavedDiagnosis[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLogoutPending, startLogoutTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  // 입시 이용권(admissions grant) 보유 여부 — 요금제 배지·안내를 계정 tier 가 아니라 실 이용권 기준으로.
  // 실 auth(pullim) 모드에서만 /me/entitlements 조회. mock/오류는 'unknown'→계정 tier 폴백(오표시 방지).
  const [admissions, setAdmissions] = useState<'checking' | 'has' | 'none' | 'unknown'>(
    () => (isPullimAuth ? 'checking' : 'unknown'),
  );

  useEffect(() => { setDiagnoses(listDiagnoses()); }, []);

  useEffect(() => {
    if (!isPullimAuth) return;
    let alive = true;
    setAdmissions('checking'); // 사용자 전환 시 이전 상태 잔존 방지(아래 user?.id 구독)
    hasAdmissionsAccess()
      .then((ok) => alive && setAdmissions(ok ? 'has' : 'none'))
      .catch(() => alive && setAdmissions('unknown')); // 일시 오류를 '미보유'로 오표시하지 않음
    return () => {
      alive = false;
    };
    // user?.id 구독 — 같은 탭 사용자 전환(A→B)에도 재조회(auth-provider 가 캐시 비움). Codex #61.
  }, [user?.id]);

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
    <div className="w-full max-w-2xl px-6 pb-16 pt-10">
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
                    : user.guardianConsent === 'unknown'
                      ? 'bg-ink-50 text-ink-600'
                      : 'bg-amber-50 text-amber-700'
                )}
              >
                {user.guardianConsent === 'approved'
                  ? '✓ 보호자 동의 완료'
                  : user.guardianConsent === 'unknown'
                    ? '보호자 동의 상태 확인 필요'
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
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold',
                admissions === 'has'
                  ? 'bg-emerald-50 text-emerald-700'
                  : admissions === 'none'
                    ? 'bg-amber-50 text-amber-700'
                    : admissions === 'checking'
                      ? 'bg-ink-100 text-ink-400'
                      : 'bg-brand-50 text-brand-700', // unknown/mock — 계정 tier 폴백
              )}
            >
              {admissions === 'has'
                ? '입시 이용권 보유'
                : admissions === 'none'
                  ? '이용권 미보유'
                  : admissions === 'checking'
                    ? '확인 중…'
                    : user.tier === 'free'
                      ? '무료'
                      : user.tier}
            </span>
          </div>
          <p className="mt-4 rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3 text-sm leading-relaxed text-ink-500">
            {admissions === 'has'
              ? '입시 이용권을 보유 중이에요. 생기부를 제출하면 진단을 이용할 수 있어요.'
              : admissions === 'none'
                ? '입시코치 진단은 입시 이용권을 구매한 회원만 이용할 수 있어요. 이용권 구매는 진단 시작 화면에서 안내됩니다.'
                : // checking/unknown — 유료 사용자를 '미보유'로 오안내하지 않도록 정책 사실만.
                  '입시코치 진단은 입시 이용권을 구매한 회원만 이용할 수 있어요.'}
          </p>
        </div>
      </section>

      {/* ── 진단 이력 ───────────────────────────────────────────────────────── */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
          진단 이력
        </h2>

        {diagnoses.length === 0 ? (
          <EmptyState
            title="아직 저장한 결과가 없어요"
            description="생기부를 제출하고 진단 결과를 저장하면 여기서 다시 볼 수 있어요."
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
              disabled={isDeletePending}
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
    </div>
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
