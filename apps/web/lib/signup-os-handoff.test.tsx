import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// /signup 직접 진입이 **실 auth 모드에서 풀림 OS 가입으로 넘어가는지** 고정한다.
//
// 이 화면의 폼은 mock 어댑터 전제로 만들어졌고, 실 어댑터의 signup·verifyEmail·
// submitGuardianConsent 는 pullim-api DTO 필드명이 아직 TODO(pullim-api-adapter.ts)다.
// 배선이 끊기면 mock 에서는 멀쩡히 돌다가 실 모드에서만 400 으로 죽는다 — 사용자가
// 처음 만나는 화면이 조용히 실패 경로가 된다. 그래서 회귀로 굳힌다.
//
// 함께 고정하는 것:
//  · 복귀 주소가 **절대 URL** 일 것 — OS resolveNext 는 allowlist 된 풀림 호스트의 절대 URL
//    만 복귀로 인정한다. 상대 경로면 무시되고 OS 홈으로 떨어진다(사용자가 입시코치로 못 돌아옴).
//  · mock 폼이 **한 프레임도 비치지 않을 것** — 리다이렉트 중 플래시는 "가입되나?" 오해를 준다.
//  · NEXT_PUBLIC_OS_URL 미설정(로컬·데모) → 내부 폼 폴백(모드 안전).

const flags = vi.hoisted(() => ({ isPullimAuth: true }));
const osSignupHref = vi.fn<(ret: string) => string | null>();
const replace = vi.fn();
let nextParam: string | null = null;

vi.mock('@/lib/auth', () => ({
  auth: { signup: vi.fn(), verifyEmail: vi.fn(), submitGuardianConsent: vi.fn() },
  get isPullimAuth() {
    return flags.isPullimAuth;
  },
}));

vi.mock('@/lib/auth/os-login', () => ({
  osSignupHref: (ret: string) => osSignupHref(ret),
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ refresh: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nextParam ? { next: nextParam } : {}),
}));

import SignupPage from '../app/signup/page';

const form = () => screen.queryByLabelText('이메일');
const spinner = () => screen.queryByText('풀림 가입 화면으로 이동 중…');

beforeEach(() => {
  vi.clearAllMocks();
  flags.isPullimAuth = true;
  nextParam = null;
  osSignupHref.mockReturnValue('https://os.example.test/signup?next=x');
  // jsdom 의 location.replace 는 "Not implemented" 를 던진다 — 호출만 관찰하도록 교체.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'http://localhost:3007', href: 'http://localhost:3007/signup', replace },
  });
});

describe('/signup — 실 auth 모드에서 가입 정본은 풀림 OS', () => {
  it('실 모드 + OS URL 설정: 폼 대신 OS 가입으로 replace 한다', async () => {
    render(<SignupPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith('https://os.example.test/signup?next=x');
  });

  it('mock 가입 폼이 한 프레임도 비치지 않는다 (리다이렉트 중에는 안내만)', async () => {
    render(<SignupPage />);
    expect(form()).toBeNull();
    expect(spinner()).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(form()).toBeNull();
  });

  it('복귀 주소는 절대 URL 이다 — 상대 경로면 OS resolveNext 가 무시하고 홈으로 떨군다', async () => {
    nextParam = '/result/abc';
    render(<SignupPage />);
    await waitFor(() => expect(osSignupHref).toHaveBeenCalled());
    expect(osSignupHref).toHaveBeenCalledWith('http://localhost:3007/result/abc');
  });

  it('next 없으면 기본 복귀는 /submit 의 절대 URL', async () => {
    render(<SignupPage />);
    await waitFor(() => expect(osSignupHref).toHaveBeenCalled());
    expect(osSignupHref).toHaveBeenCalledWith('http://localhost:3007/submit');
  });

  it('외부 next 는 safeNext 가 막는다 — 오픈 리다이렉트로 새지 않는다', async () => {
    nextParam = 'https://evil.test/steal';
    render(<SignupPage />);
    await waitFor(() => expect(osSignupHref).toHaveBeenCalled());
    expect(osSignupHref).toHaveBeenCalledWith('http://localhost:3007/submit');
  });

  it('OS URL 미설정(null): replace 없이 내부 mock 폼으로 폴백한다', async () => {
    osSignupHref.mockReturnValue(null);
    render(<SignupPage />);
    await waitFor(() => expect(form()).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
    expect(spinner()).toBeNull();
  });

  it('mock auth 모드: OS 로 보내지 않고 내부 폼을 쓴다', async () => {
    flags.isPullimAuth = false;
    render(<SignupPage />);
    await waitFor(() => expect(form()).toBeInTheDocument());
    expect(osSignupHref).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
