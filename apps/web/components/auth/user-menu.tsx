'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { osLoginHref, osSignupHref } from '@/lib/auth/os-login';
import { cn } from '@/lib/utils';

const LOGIN_CTA_CLASS =
  'rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700';

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

  // 일시 오류(/me 일시 실패) — 로그아웃이 아니므로 로그인/가입 CTA를 띄우지 않는다.
  if (status === 'error') {
    return (
      <div className={cn('flex items-center', className)}>
        <span className="text-xs text-ink-400">일시 오류</span>
      </div>
    );
  }

  // guest — NEXT_PUBLIC_OS_URL 설정 시 OS 로그인으로 SSO redirect(돌아올 URL을 next로),
  // 미설정 시 내부 /login(mock) 폴백.
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {process.env.NEXT_PUBLIC_OS_URL ? (
        <button
          type="button"
          onClick={() => window.location.assign(osLoginHref(window.location.href) ?? '/login')}
          className={LOGIN_CTA_CLASS}
        >
          로그인
        </button>
      ) : (
        <Link href="/login" className={LOGIN_CTA_CLASS}>
          로그인
        </Link>
      )}
      {process.env.NEXT_PUBLIC_OS_URL ? (
        <button
          type="button"
          onClick={() => window.location.assign(osSignupHref(window.location.href) ?? '/signup')}
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          가입
        </button>
      ) : (
        <Link
          href="/signup"
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          가입
        </Link>
      )}
    </div>
  );
}
