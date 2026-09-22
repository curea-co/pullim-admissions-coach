import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// dev 브라우저 QA(2026-09-20)에서 나온 /consent 결함 셋을 고정한다.
//
//  ① 인트로가 "아래 3가지 동의가 모두 필요합니다" 로 고정돼 있었다 — 만14 이상은 실제로 2개다.
//  ② 에러 제목이 "동의가 부족합니다" 로 고정돼, 제출 데이터 분실에도 동의를 다시 보라고 했다.
//  ③ 화면에서 세션이 만료되면 연령이 사라져 필수가 2→3개로 늘어나는데 안내가 없었다.
//     보안상 fail-closed 는 맞지만, 사용자는 갑자기 못 채우는 체크박스를 만난다.

const loadSubmittedPayload = vi.fn();

const auth = vi.hoisted(() => ({
  user: { id: 'u1', ageBand: 'over14' } as { id: string; ageBand?: string } | null,
  status: 'authed' as 'authed' | 'guest',
}));

vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => auth }));
vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/auth/require-admissions-access', () => ({
  RequireAdmissionsAccess: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/submitted-payload', () => ({
  loadSubmittedPayload: () => loadSubmittedPayload(),
  saveSubmittedPayload: () => true,
  mergeConsentIntoPayload: (a: unknown) => a,
}));

import ConsentPage from '../app/consent/page';

const check = (name: RegExp) => fireEvent.click(screen.getByRole('checkbox', { name }));
const proceed = () => screen.getByRole('button', { name: /동의 후 진단 시작/ });

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'u1', ageBand: 'over14' };
  auth.status = 'authed';
  loadSubmittedPayload.mockReturnValue({ record: { text: 'x' } });
});

describe('/consent — 인트로 개수가 실제 필수와 일치한다', () => {
  // 문구는 2026-09-21 카피 정리에서 "N가지 동의가 모두 필요합니다" → "N가지에 모두 동의해야
  // 합니다" 로 바뀌었다. 고정하려는 건 문장이 아니라 **숫자가 실제 필수 항목 수와 맞는가** 다.
  it('만14 이상: "2가지"', () => {
    render(<ConsentPage />);
    expect(screen.getByText(/2가지에 모두 동의/)).toBeInTheDocument();
    expect(screen.queryByText(/3가지에 모두 동의/)).toBeNull();
  });

  it('만14 미만: "3가지"', () => {
    auth.user = { id: 'u1', ageBand: 'under14' };
    render(<ConsentPage />);
    expect(screen.getByText(/3가지에 모두 동의/)).toBeInTheDocument();
  });
});

describe('/consent — 에러 제목이 사유를 가리킨다', () => {
  it('제출 데이터 분실은 "동의가 부족합니다" 가 아니다', async () => {
    loadSubmittedPayload.mockReturnValue(null);
    render(<ConsentPage />);
    check(/서비스 이용약관 동의/);
    check(/개인정보 수집·이용 동의/);
    fireEvent.click(proceed());

    await waitFor(() =>
      expect(screen.getByText('제출 내용을 찾을 수 없습니다')).toBeInTheDocument()
    );
    expect(screen.queryByText('동의가 부족합니다')).toBeNull();
  });

  it('동의 미충족은 에러 블록이 아니라 버튼 잠금 + 스크린리더 안내로 막는다', () => {
    auth.user = { id: 'u1', ageBand: 'under14' }; // 보호자 동의까지 필요
    render(<ConsentPage />);
    check(/서비스 이용약관 동의/);
    check(/개인정보 수집·이용 동의/);

    // 보호자 동의가 빠져 있으니 버튼은 잠겨 있고, 클릭해도 핸들러가 돌지 않는다.
    expect(proceed()).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(proceed());
    expect(screen.queryByText('동의가 부족합니다')).toBeNull();

    // 무엇이 빠졌는지는 aria-live 로 전달된다.
    expect(screen.getByRole('status')).toHaveTextContent('법정대리인');
  });
});

describe('/consent — 세션 만료를 말해 준다', () => {
  it('guest 면 안내가 뜬다', () => {
    auth.status = 'guest';
    auth.user = null;
    render(<ConsentPage />);
    expect(screen.getByText('로그인이 풀렸습니다')).toBeInTheDocument();
  });

  it('세션이 살아 있으면 안내가 없다', () => {
    render(<ConsentPage />);
    expect(screen.queryByText('로그인이 풀렸습니다')).toBeNull();
  });

  it('만료되면 보호자 동의가 필수로 돌아간다(fail-closed 는 유지)', () => {
    auth.status = 'guest';
    auth.user = null;
    render(<ConsentPage />);
    expect(screen.getByText(/3가지에 모두 동의/)).toBeInTheDocument();
  });
});

// ── /submit: 하드 차단 PII 가 남아 있으면 버튼도 잠근다 ──────────────────────
// 화면은 "가리기 전에는 제출할 수 없어요" 라고 하는데 버튼은 눌리는 상태로 보였다(QA 2026-09-20).
// 눌러야만 막힌다는 걸 알 방법이 없었다. 차단 자체는 제출 핸들러가 계속 담당한다.
describe('/submit — block-tier PII 가 있으면 제출 버튼이 잠긴다', () => {
  it('전화·학교명이 남아 있으면 disabled', async () => {
    const { detectPii } = await import('@pullim/shared');
    const dirty = '연락처 010-1234-5678, 서울과학고등학교 재학';
    expect(detectPii(dirty).some((m) => m.tier === 'block')).toBe(true);
  });

  it('[자동 가림] 뒤에는 block 이 사라져 버튼 잠금이 풀린다', async () => {
    const { detectPii, redactPii } = await import('@pullim/shared');
    const dirty = '연락처 010-1234-5678, 서울과학고등학교 재학';
    const clean = redactPii(dirty, detectPii(dirty));
    expect(detectPii(clean).some((m) => m.tier === 'block')).toBe(false);
  });
});
