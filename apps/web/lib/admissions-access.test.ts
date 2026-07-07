import { describe, it, expect, vi, beforeEach } from 'vitest';

// admissions 사전 게이트 신호(hasAdmissionsAccess) 회귀 고정 — Codex #59 리뷰.
// flags.admissions(#348) 로 판정하고, 401/네트워크 오류는 전파해 "구매 벽 오분류"를 막는지 확인.
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), request: vi.fn() },
}));

import { api } from '@/lib/api';
import { hasAdmissionsAccess, clearAdmissionsAccessCache } from './admissions-api';

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>;

describe('hasAdmissionsAccess — /me/entitlements flags.admissions 사전 게이트(#348)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAdmissionsAccessCache(); // 세션 캐시가 케이스 간 잔존하지 않게(모듈 전역).
  });

  it('flags.admissions ≥ 1 → true (유료 회원 진입)', async () => {
    mockGet.mockResolvedValue({ flags: { admissions: 2, q: 1 }, package: 'suwon', tier: 'b2g' });
    await expect(hasAdmissionsAccess()).resolves.toBe(true);
    expect(mockGet).toHaveBeenCalledWith('/me/entitlements');
  });

  it('admissions 부재 → false (free 회원 = 구매 벽)', async () => {
    mockGet.mockResolvedValue({ flags: { q: 1 }, package: 'home', tier: 'free' });
    await expect(hasAdmissionsAccess()).resolves.toBe(false);
  });

  it('admissions: 0 → false', async () => {
    mockGet.mockResolvedValue({ flags: { admissions: 0 }, package: 'home', tier: 'free' });
    await expect(hasAdmissionsAccess()).resolves.toBe(false);
  });

  it('401/네트워크 오류는 전파 — 구매 벽으로 오분류하지 않음', async () => {
    mockGet.mockRejectedValue(Object.assign(new Error('expired'), { status: 401, authExpired: true }));
    await expect(hasAdmissionsAccess()).rejects.toMatchObject({ status: 401 });
  });

  it('malformed 응답(flags 누락) → throw — 유료 사용자를 구매 벽으로 오분류하지 않음', async () => {
    mockGet.mockResolvedValue({ package: 'home', tier: 'free' }); // flags 없음(부분 배포/스키마 어긋남)
    await expect(hasAdmissionsAccess()).rejects.toThrow('형식 오류');
  });
});
