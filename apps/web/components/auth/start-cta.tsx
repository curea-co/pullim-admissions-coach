'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
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

  const href = status === 'authed' ? ('/submit' as const) : ('/signup' as const);

  return (
    <Link href={href} className={cn(className)}>
      {children}
    </Link>
  );
}
