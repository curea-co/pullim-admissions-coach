'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { isOsAuthEnabled, redirectToOsAuth } from '@/lib/auth/os-login';
import { cn } from '@/lib/utils';

export function UserMenu({ className }: { className?: string }) {
  const { user, status, logout } = useAuth();

  if (status === 'loading') {
    return (
      <div className={cn('flex items-center gap-2', className)} aria-busy="true">
        <div className="h-7 w-16 animate-pulse rounded-xl bg-ink-100" />
        <div className="h-7 w-12 animate-pulse rounded-xl bg-ink-100" />
      </div>
    );
  }

  if (status === 'authed' && user) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Link
          href="/mypage"
          className="rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
        >
          {user.displayName}
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-sm font-medium text-ink-500 transition hover:border-ink-200 hover:text-ink-700"
        >
          로그아웃
        </button>
      </div>
    );
  }

  // guest — 중앙 로그인(OS) 모드면 ${OS}/login?next= 로 보낸다(ADR-010). 미설정이면 자체 페이지(데모).
  const loginCls =
    'rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700';
  const signupCls =
    'rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700';

  if (isOsAuthEnabled()) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <button type="button" onClick={() => redirectToOsAuth('login')} className={loginCls}>
          로그인
        </button>
        <button type="button" onClick={() => redirectToOsAuth('signup')} className={signupCls}>
          가입
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Link href="/login" className={loginCls}>
        로그인
      </Link>
      <Link href="/signup" className={signupCls}>
        가입
      </Link>
    </div>
  );
}
