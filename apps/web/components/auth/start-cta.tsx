'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { isOsAuthEnabled, redirectToOsAuth } from '@/lib/auth/os-login';
import { cn } from '@/lib/utils';

interface StartCtaProps {
  children: React.ReactNode;
  className?: string;
}

export function StartCta({ children, className }: StartCtaProps) {
  const { status } = useAuth();

  if (status === 'loading') {
    // 인증 상태 확인 전 — 네비게이션 방지(비활성 span)
    return (
      <span aria-disabled="true" className={cn(className, 'cursor-wait opacity-60')}>
        {children}
      </span>
    );
  }

  // 비로그인 + 중앙 로그인(OS) 모드: 자체 /signup 대신 ${OS}/signup?next= 로 보낸다(ADR-010).
  if (status !== 'authed' && isOsAuthEnabled()) {
    return (
      <button type="button" onClick={() => redirectToOsAuth('signup')} className={cn(className)}>
        {children}
      </button>
    );
  }

  const href = status === 'authed' ? ('/submit' as const) : ('/signup' as const);

  return (
    <Link href={href} className={cn(className)}>
      {children}
    </Link>
  );
}
