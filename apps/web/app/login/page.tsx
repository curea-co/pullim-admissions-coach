'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

// ── inner form (reads useSearchParams) ───────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, refresh } = useAuth();

  const next = searchParams.get('next') ?? '/mypage';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // typedRoutes: next는 require-auth가 주입한 내부 경로이므로 StaticRoutes로 단언
  type AppRoute = '/consent' | '/login' | '/parent' | '/processing' | '/' | '/signup' | '/result' | '/mypage' | '/submit';
  const nextRoute = next as AppRoute;

  // 이미 로그인된 경우 즉시 이동
  useEffect(() => {
    if (status === 'authed') {
      router.push(nextRoute);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await auth.login(email, password);
      await refresh();
      startTransition(() => {
        router.push(nextRoute);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.');
    }
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* 카드 */}
        <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">로그인</h1>
          <p className="mt-1.5 text-sm text-ink-500">계정에 로그인하세요.</p>

          <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit}>
            {/* 이메일 */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-ink-900"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={cn(
                  'w-full rounded-xl border px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300',
                  'focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100',
                  'border-ink-100 bg-white'
                )}
              />
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-ink-900"
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={cn(
                  'w-full rounded-xl border px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300',
                  'focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100',
                  'border-ink-100 bg-white'
                )}
              />
            </div>

            {/* 인라인 에러 */}
            {error && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-2.5 text-sm font-medium text-rose-700">
                {error}
              </p>
            )}

            {/* 제출 */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {isPending ? '로그인 중…' : '로그인'}
            </button>
          </form>

          {/* 가입 링크 */}
          <p className="mt-5 text-center text-sm text-ink-500">
            계정이 없으신가요?{' '}
            <Link
              href="/signup"
              className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              가입
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// ── page export (Suspense boundary for useSearchParams) ───────────────────────

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[80vh] items-center justify-center px-4">
          <p className="text-sm text-ink-400">불러오는 중…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
