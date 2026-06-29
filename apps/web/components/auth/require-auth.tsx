'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { isOsAuthEnabled, redirectToOsAuth } from '@/lib/auth/os-login';
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter(); const pathname = usePathname();
  useEffect(() => {
    if (status !== 'guest') return;
    // 중앙 로그인(OS) 모드: ${OS}/login?next=<현재 경로> 로 보내고 복귀(ADR-010).
    // 미설정이면 자체 /login(데모).
    if (isOsAuthEnabled()) {
      redirectToOsAuth('login', pathname);
    } else {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);
  if (status !== 'authed') {
    return <div className="px-6 py-10 text-sm text-ink-500">확인 중…</div>;
  }
  return <>{children}</>;
}
