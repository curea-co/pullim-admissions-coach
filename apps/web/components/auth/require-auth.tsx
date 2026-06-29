'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { osLoginHref } from '@/lib/auth/os-login';
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, refresh } = useAuth();
  const router = useRouter(); const pathname = usePathname();
  useEffect(() => {
    // 'guest'(미인증/만료)만 로그인으로. 'error'(서버/네트워크 일시 장애)는 강등하지 않는다.
    // SSO 모드(NEXT_PUBLIC_OS_URL)면 OS 로그인으로 보내 UserMenu와 진입점을 통일, 아니면 내부 /login.
    if (status === 'guest') {
      const sso = osLoginHref(window.location.href);
      if (sso) window.location.assign(sso);
      else router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  // 일시 오류 — 로그아웃시키지 않고 재시도 제공(백엔드 장애 시 강제 로그인 방지).
  if (status === 'error') {
    return (
      <div className="px-6 py-10 text-sm text-ink-600">
        <p className="mb-3">일시적으로 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (status !== 'authed') {
    return <div className="px-6 py-10 text-sm text-ink-500">확인 중…</div>;
  }
  return <>{children}</>;
}
