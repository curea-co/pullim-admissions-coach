import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// /processing 의 403 처리 회귀 — dev QA(2026-09-20).
//
// 이용권이 없어 403 이 나면 화면에 "분석 중 오류가 발생했습니다" 와 **"다시 시도"** 만 떴다.
// 눌러도 같은 403 이라 영원히 실패한다. 게다가 위쪽에 "제출이 접수되었습니다" 가 그대로 남아
// 있어서, 사용자는 제출이 된 건지 안 된 건지도 알 수 없었다.
//
// 지금은 이용권 게이트를 따로 알아보고 마이페이지(쿠폰 등록)로 보낸다.

const submitAndDiagnose = vi.fn();

vi.mock('@/lib/admissions-api', () => ({
  submitAndDiagnose: (p: unknown) => submitAndDiagnose(p),
  getDiagnosis: vi.fn(),
  saveLastResultId: vi.fn(),
  loadLastResultId: () => null,
  fetchLatestDiagnosis: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/submitted-payload', () => ({
  loadSubmittedPayload: () => ({ ok: true }),
  clearSubmittedPayload: vi.fn(),
}));
vi.mock('@/lib/result-view', () => ({ clearAnalyzeResult: vi.fn() }));
// router 는 **렌더마다 같은 객체**여야 한다 — 이 페이지의 useEffect 가 [router] 를 구독하므로
// 매번 새 객체를 돌려주면 effect 가 무한 재실행된다(테스트가 조용히 루프로 죽는다).
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/auth/require-admissions-access', () => ({
  RequireAdmissionsAccess: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// 페이로드 파싱은 이 테스트의 관심사가 아니다 — 항상 통과시키고 API 실패 분기만 본다.
vi.mock('@pullim/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@pullim/shared');
  return { ...actual, studentProfileSchema: { safeParse: () => ({ success: true, data: {} }) } };
});

import ProcessingPage from '../app/processing/page';

function apiError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code });
}

beforeEach(() => vi.clearAllMocks());

describe('/processing — 이용권 403', () => {
  it('이용권이 없으면 재시도 대신 등록 경로를 준다', async () => {
    submitAndDiagnose.mockRejectedValue(apiError(403, 'FORBIDDEN', '접근 권한이 없습니다.'));
    render(<ProcessingPage />);

    await waitFor(() =>
      expect(screen.getByText('진단을 시작할 수 없습니다')).toBeInTheDocument()
    );
    expect(screen.getByRole('link', { name: /이용권·쿠폰 등록하기/ })).toHaveAttribute(
      'href',
      '/mypage'
    );
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
  });

  it('서버 원문 대신 무엇을 해야 하는지 말한다', async () => {
    submitAndDiagnose.mockRejectedValue(apiError(403, 'FORBIDDEN', '접근 권한이 없습니다.'));
    render(<ProcessingPage />);
    await waitFor(() => expect(screen.getByText(/마이페이지에서 등록/)).toBeInTheDocument());
  });

  it('에러 상태에서는 "제출이 접수되었습니다" 를 감춘다', async () => {
    submitAndDiagnose.mockRejectedValue(apiError(403, 'FORBIDDEN', '접근 권한이 없습니다.'));
    render(<ProcessingPage />);
    await waitFor(() =>
      expect(screen.getByText('진단을 시작할 수 없습니다')).toBeInTheDocument()
    );
    expect(screen.queryByText(/제출이 접수되었습니다/)).toBeNull();
  });

  it('일반 오류(5xx)는 기존대로 재시도를 준다', async () => {
    submitAndDiagnose.mockRejectedValue(apiError(500, 'INTERNAL', '서버 오류'));
    render(<ProcessingPage />);

    await waitFor(() =>
      expect(screen.getByText('분석 중 오류가 발생했습니다')).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /이용권·쿠폰 등록하기/ })).toBeNull();
  });

  it('403 이어도 code 가 FORBIDDEN 이 아니면 이용권 안내로 오인하지 않는다', async () => {
    submitAndDiagnose.mockRejectedValue(
      apiError(403, 'CSRF_ORIGIN_REJECTED', 'CSRF: Origin 검증 실패.')
    );
    render(<ProcessingPage />);
    await waitFor(() =>
      expect(screen.getByText('분석 중 오류가 발생했습니다')).toBeInTheDocument()
    );
    expect(screen.queryByRole('link', { name: /이용권·쿠폰 등록하기/ })).toBeNull();
  });
});
