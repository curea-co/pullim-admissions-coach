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

  // Codex #70 P1 — 조회 중 사용자 전환 경합. 무효화해도 이미 날아간 요청은 취소되지 않으므로,
  // 늦게 도착한 이전 사용자(A)의 응답이 캐시를 오염시켜 다음 사용자(B)가 A 의 이용권으로
  // 판정되던 문제. 세대 번호로 stale 응답의 캐시 쓰기를 버린다.
  it('조회 중 사용자 전환 → 이전 사용자의 늦은 응답이 캐시를 오염시키지 않는다', async () => {
    // A: 이용권 보유. 응답을 수동으로 지연시켜 "전환이 먼저 일어나는" 순서를 만든다.
    let resolveA: (v: unknown) => void = () => {};
    mockGet.mockReturnValueOnce(new Promise((r) => { resolveA = r; }));
    const aPending = hasAdmissionsAccess();

    // 사용자 전환(auth-provider.refresh 가 호출하는 경로).
    clearAdmissionsAccessCache();

    // 이제 A 의 응답이 뒤늦게 도착한다.
    resolveA({ flags: { admissions: 2 }, package: 'suwon', tier: 'b2g' });
    await expect(aPending).resolves.toBe(true); // 호출자(A)는 자기 값을 그대로 받는다

    // B: 미보유. 캐시가 오염됐다면 A 의 true 가 그대로 반환되어 이 단언이 깨진다.
    mockGet.mockResolvedValueOnce({ flags: { q: 1 }, package: 'home', tier: 'free' });
    await expect(hasAdmissionsAccess()).resolves.toBe(false);
    expect(mockGet).toHaveBeenCalledTimes(2); // B 는 캐시를 읽지 않고 새로 조회했다
  });
});
