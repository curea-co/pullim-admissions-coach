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

  // When loading, send to /signup (safe default — auth redirect handles the rest).
  const href = status === 'authed' ? ('/submit' as const) : ('/signup' as const);

  return (
    <Link href={href} className={cn(className)}>
      {children}
    </Link>
  );
}
