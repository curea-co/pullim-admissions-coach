'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { auth, isPullimAuth } from '@/lib/auth';
import { osSignupHref } from '@/lib/auth/os-login';
import { useAuth } from '@/components/auth/auth-provider';
import { safeNext } from '@/lib/safe-next';
import { cn } from '@/lib/utils';

// ── 단계 정의 ─────────────────────────────────────────────────────────────────

type Step = 'account' | 'verify' | 'guardian' | 'done';

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'account', label: '가입' },
  { key: 'verify', label: '인증' },
  { key: 'guardian', label: '보호자' },
  { key: 'done', label: '완료' },
];

// ── 진행 표시기 ───────────────────────────────────────────────────────────────

function StepIndicator({
  current,
  showGuardian,
}: {
  current: Step;
  showGuardian: boolean;
}) {
  const steps = showGuardian
    ? STEP_LABELS
    : STEP_LABELS.filter((s) => s.key !== 'guardian');

  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="mb-6 flex items-center justify-center gap-0">
      {steps.map((s, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                  isDone && 'bg-brand-600 text-white',
                  isCurrent && 'border-2 border-brand-600 bg-white text-brand-600',
                  !isDone && !isCurrent && 'border border-ink-200 bg-white text-ink-400'
                )}
              >
                {isDone ? '✓' : i + 1}
              </span>
              <span
                className={cn(
                  'text-[10px]',
                  isCurrent ? 'font-semibold text-brand-700' : 'text-ink-400'
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={cn('mb-4 h-px w-8', i < currentIdx ? 'bg-brand-400' : 'bg-ink-100')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 메인 폼 (useSearchParams 사용 → Suspense 안에서) ──────────────────────────

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();

  // 오픈 리다이렉트 가드(auth 설계 §5): 내부 경로만 허용.
  const nextRoute = safeNext(searchParams.get('next'), '/submit') as unknown as Route;

  // 실 auth 모드에서는 이 화면을 쓰지 않는다 — 가입 정본은 풀림 OS 다.
  //
  // 아래 폼은 mock 어댑터를 전제로 만들어졌고, 실 어댑터의 signup·verifyEmail·
  // submitGuardianConsent 는 pullim-api DTO 필드명이 아직 TODO 다. mock 에서는 멀쩡히
  // 돌다가 실 모드로 바꾸는 순간 이 세 단계만 400 으로 죽는다 — 사용자가 처음 만나는
  // 화면이 실패하는 경로가 된다. 채우는 대신 **정본으로 보낸다**: user-menu 의 가입
  // 버튼이 이미 osSignupHref 로 가므로, URL 직접 진입만 여기서 같은 곳으로 돌린다.
  //
  // OS URL 미설정(로컬·데모)이면 null → 폴백 없이 폼을 그대로 쓴다(모드 안전).
  // 복귀 주소는 **절대 URL** 이어야 한다 — OS resolveNext 가 allowlist 된 풀림 호스트의
  // 절대 URL 만 복귀로 인정한다(상대 경로는 무시되고 OS 홈으로 떨어진다).
  const [redirecting, setRedirecting] = useState(isPullimAuth);
  useEffect(() => {
    if (!isPullimAuth) return;
    const href = osSignupHref(new URL(nextRoute, window.location.origin).toString());
    if (href) window.location.replace(href);
    else setRedirecting(false); // OS URL 미설정 — 내부 폼으로 폴백
  }, [nextRoute]);

  // 단계 상태
  const [step, setStep] = useState<Step>('account');
  const [needsGuardianConsent, setNeedsGuardianConsent] = useState(false);
  const [isPending, startTransition] = useTransition();

  // account 필드
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // verify 필드
  const [code, setCode] = useState('');

  // guardian 필드
  const [guardianName, setGuardianName] = useState('');
  const [relation, setRelation] = useState('부');
  const [phone, setPhone] = useState('');

  // 에러
  const [error, setError] = useState<string | null>(null);

  // ── account 제출 ──────────────────────────────────────────────────────────

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password || !displayName || !birthDate) {
      setError('모든 항목을 입력해 주세요.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await auth.signup({ email, password, displayName, birthDate });
        setNeedsGuardianConsent(result.needsGuardianConsent);
        setStep('verify');
      } catch (err) {
        setError(err instanceof Error ? err.message : '가입 중 오류가 발생했습니다.');
      }
    });
  }

  // ── verify 제출 ───────────────────────────────────────────────────────────

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError('인증 코드를 입력해 주세요.');
      return;
    }

    startTransition(async () => {
      try {
        await auth.verifyEmail(code);
        if (needsGuardianConsent) {
          setStep('guardian');
        } else {
          await finish();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '인증 중 오류가 발생했습니다.');
      }
    });
  }

  // ── guardian 제출 ─────────────────────────────────────────────────────────

  async function handleGuardian(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!guardianName || !phone) {
      setError('보호자 이름과 연락처를 입력해 주세요.');
      return;
    }

    startTransition(async () => {
      try {
        await auth.submitGuardianConsent({ guardianName, relation, phone });
        await finish();
      } catch (err) {
        setError(err instanceof Error ? err.message : '보호자 동의 제출 중 오류가 발생했습니다.');
      }
    });
  }

  // ── 완료 처리 ─────────────────────────────────────────────────────────────

  async function finish() {
    setStep('done');
    await refresh();
    router.push(nextRoute);
  }

  // ── 공용 입력 스타일 ──────────────────────────────────────────────────────

  const inputCls = cn(
    'w-full rounded-xl border px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300',
    'focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100',
    'border-ink-100 bg-white'
  );

  const labelCls = 'text-sm font-medium text-ink-900';

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  // 풀림 OS 가입으로 넘어가는 중 — mock 폼이 한 프레임이라도 비치지 않게 한다.
  if (redirecting) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <p className="text-sm text-ink-400">풀림 가입 화면으로 이동 중…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
          {/* 헤더 */}
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">회원가입</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            {step === 'verify' && '이메일로 보낸 인증 코드를 입력해 주세요.'}
            {step === 'guardian' && '미성년자의 경우 보호자 동의가 필요합니다.'}
            {step === 'done' && '가입이 완료되었습니다. 이동 중…'}
          </p>

          {/* 진행 표시기 */}
          <div className="mt-5">
            <StepIndicator current={step} showGuardian={needsGuardianConsent} />
          </div>

          {/* ── account 단계 ── */}
          {step === 'account' && (
            <form className="space-y-4" noValidate onSubmit={handleAccount}>
              <div className="space-y-1.5">
                <label htmlFor="email" className={labelCls}>이메일</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className={labelCls}>비밀번호</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상"
                  required
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="displayName" className={labelCls}>이름</label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="홍길동"
                  required
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="birthDate" className={labelCls}>생년월일</label>
                <input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-2.5 text-sm font-medium text-rose-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {isPending ? '처리 중…' : '다음'}
              </button>
            </form>
          )}

          {/* ── verify 단계 ── */}
          {step === 'verify' && (
            <form className="space-y-4" noValidate onSubmit={handleVerify}>
              {/* mock 모드 전용 안내 — 실 auth(pullim) 경로에서는 실제 코드가 필요하므로 숨긴다.
                  예전에는 무조건 렌더돼 OS URL 미설정 폴백을 탄 실사용자에게도 보였다. */}
              {!isPullimAuth && (
                <p className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-2.5 text-sm text-brand-700">
                  데모: 아무 코드나 입력
                </p>
              )}

              <div className="space-y-1.5">
                <label htmlFor="code" className={labelCls}>인증 코드</label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  className={inputCls}
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-2.5 text-sm font-medium text-rose-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {isPending ? '인증 중…' : '인증 확인'}
              </button>
            </form>
          )}

          {/* ── guardian 단계 ── */}
          {step === 'guardian' && (
            <form className="space-y-4" noValidate onSubmit={handleGuardian}>
              <div className="space-y-1.5">
                <label htmlFor="guardianName" className={labelCls}>보호자 이름</label>
                <input
                  id="guardianName"
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="홍부모"
                  required
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="relation" className={labelCls}>관계</label>
                <select
                  id="relation"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  className={inputCls}
                >
                  <option value="부">부</option>
                  <option value="모">모</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="phone" className={labelCls}>연락처</label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  required
                  className={inputCls}
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-2.5 text-sm font-medium text-rose-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {isPending ? '제출 중…' : '동의 제출'}
              </button>
            </form>
          )}

          {/* ── done 단계 ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center py-4">
              <span className="text-3xl" aria-hidden>✓</span>
              <p className="mt-2 text-sm text-ink-500">가입이 완료되었어요</p>
            </div>
          )}

          {/* 로그인 링크 */}
          {step === 'account' && (
            <p className="mt-5 text-center text-sm text-ink-500">
              이미 계정이 있으신가요?{' '}
              <Link
                href="/login"
                className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                로그인
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 페이지 export (Suspense boundary for useSearchParams) ─────────────────────

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center px-4">
          <p className="text-sm text-ink-400">불러오는 중…</p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
