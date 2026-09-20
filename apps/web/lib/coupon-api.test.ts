import { describe, it, expect, vi, beforeEach } from 'vitest';

// 쿠폰 등록 클라이언트 회귀 — 이 경로가 깨지면 **이용권을 얻을 방법이 없다.**
// OS 상품 카탈로그의 결제 딥링크가 아직 없어서 쿠폰이 지금 동작하는 유일한 획득 경로다.
//
// 특히 고정하는 두 가지:
//  · 분기 축이 **HTTP 상태**일 것 — 서버 전역 필터는 403 에만 `code` 를 붙이고 400·404·409 에는
//    기계 코드가 없다. 메시지 문구로 분기하면 서버 문안을 다듬는 순간 조용히 깨진다.
//  · `admissionsGranted` 가 grants 를 실제로 볼 것 — 다른 서비스 쿠폰은 200 인데 입시코치는
//    계속 막힌다. 이 플래그가 항상 true 가 되면 "등록됐다는데 왜 안 열리지" 가 된다.

const post = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (p: string, b: unknown) => post(p, b) } }));

import { redeemCoupon, isValidCouponCode, COUPON_CODE_PATTERN } from './coupon-api';

/** 서버 전역 필터가 내는 모양(`{statusCode, message, error}`)을 lib/api.ts 가 정규화한 뒤의 에러. */
function apiError(status: number, message = '서버 문장') {
  return Object.assign(new Error(message), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  post.mockResolvedValue({ grants: [], credit: null });
});

describe('isValidCouponCode — 서버 DTO 와 같은 패턴', () => {
  it('내부 생성 코드 XXXX-XXXX-XXXX 를 받는다', () => {
    expect(isValidCouponCode('ABCD-EF23-GHJ4')).toBe(true);
  });

  it('하이픈 없는 외부 업체 코드도 받는다(12자 이상)', () => {
    expect(isValidCouponCode('SUWONTEACHER2026')).toBe(true);
  });

  it('11자는 거부 — 12자 하한은 brute-force 방어 엔트로피 floor 라 낮추지 않는다', () => {
    expect(isValidCouponCode('ABCDEFGHIJK')).toBe(false);
  });

  it('65자는 거부', () => {
    expect(isValidCouponCode('A'.repeat(65))).toBe(false);
  });

  it('허용되지 않는 문자(공백·밑줄·한글)는 거부', () => {
    expect(isValidCouponCode('ABCD EF23 GHJ4')).toBe(false);
    expect(isValidCouponCode('ABCD_EF23_GHJ4')).toBe(false);
    expect(isValidCouponCode('쿠폰코드입니다열두자')).toBe(false);
  });

  it('앞뒤 공백은 잘라내고 본다 — 붙여넣기 흔한 실수', () => {
    expect(isValidCouponCode('  ABCD-EF23-GHJ4  ')).toBe(true);
  });

  it('패턴이 서버 @Matches 와 문자열로 동일하다', () => {
    expect(COUPON_CODE_PATTERN.source).toBe('^[A-Za-z0-9-]{12,64}$');
  });
});

describe('redeemCoupon — 성공 경로', () => {
  it('admissions grant 가 오면 admissionsGranted=true', async () => {
    post.mockResolvedValue({
      grants: [{ service: 'admissions', level: 2, expiresAt: '2027-01-01T00:00:00.000Z' }],
      credit: null,
    });
    const out = await redeemCoupon('ABCD-EF23-GHJ4');
    expect(out).toMatchObject({ ok: true, admissionsGranted: true });
  });

  it('다른 서비스 grant 만 오면 ok 지만 admissionsGranted=false', async () => {
    post.mockResolvedValue({
      grants: [{ service: 'planner', level: 2, expiresAt: '2027-01-01T00:00:00.000Z' }],
      credit: null,
    });
    const out = await redeemCoupon('ABCD-EF23-GHJ4');
    expect(out).toMatchObject({ ok: true, admissionsGranted: false });
  });

  it('6종 번들처럼 여러 grant 중 admissions 가 섞여 있으면 true', async () => {
    post.mockResolvedValue({
      grants: [
        { service: 'q', level: 2, expiresAt: 'x' },
        { service: 'admissions', level: 2, expiresAt: 'x' },
        { service: 'junior', level: 2, expiresAt: 'x' },
      ],
      credit: null,
    });
    const out = await redeemCoupon('ABCD-EF23-GHJ4');
    expect(out).toMatchObject({ ok: true, admissionsGranted: true });
  });

  it('크레딧 전용 쿠폰(grants 빈 배열)은 admissionsGranted=false', async () => {
    post.mockResolvedValue({ grants: [], credit: { amount: 1000, expiresAt: null } });
    const out = await redeemCoupon('ABCD-EF23-GHJ4');
    expect(out).toMatchObject({ ok: true, admissionsGranted: false });
  });

  it('level 0 은 이용권으로 치지 않는다 — 게이트 판정식이 >= 1 이다', async () => {
    post.mockResolvedValue({
      grants: [{ service: 'admissions', level: 0, expiresAt: 'x' }],
      credit: null,
    });
    const out = await redeemCoupon('ABCD-EF23-GHJ4');
    expect(out).toMatchObject({ ok: true, admissionsGranted: false });
  });

  it('코드는 trim 해서 보내되 대소문자는 바꾸지 않는다 — 소문자 발급 코드가 404 로 떨어진다', async () => {
    await redeemCoupon('  abcd-ef23-ghj4  ');
    expect(post).toHaveBeenCalledWith('/billing/coupons/redeem', { code: 'abcd-ef23-ghj4' });
  });
});

describe('redeemCoupon — 실패 경로는 HTTP 상태로 가른다', () => {
  const cases: [number, string][] = [
    [400, 'invalid_format'],
    [401, 'unauthenticated'],
    [403, 'not_eligible'],
    [404, 'not_redeemable'],
    [409, 'already_redeemed'],
    [500, 'unknown'],
  ];

  it.each(cases)('%i → %s', async (status, failure) => {
    post.mockRejectedValue(apiError(status));
    const out = await redeemCoupon('ABCD-EF23-GHJ4');
    expect(out).toMatchObject({ ok: false, failure });
  });

  it('서버 문장이 있으면 그대로 보여준다 — 404 는 사유를 구분하지 않는 단일 문장이다', async () => {
    post.mockRejectedValue(
      apiError(404, '쿠폰을 사용할 수 없습니다. 코드를 다시 확인해 주세요.')
    );
    const out = await redeemCoupon('ABCD-EF23-GHJ4');
    expect(out).toMatchObject({
      ok: false,
      message: '쿠폰을 사용할 수 없습니다. 코드를 다시 확인해 주세요.',
    });
  });

  it('404 문구에 만료·소진 같은 추측을 덧붙이지 않는다(enumeration 저항)', async () => {
    post.mockRejectedValue(apiError(404, ''));
    const out = await redeemCoupon('ABCD-EF23-GHJ4');
    if (out.ok) throw new Error('실패 경로여야 한다');
    expect(out.message).not.toMatch(/만료|소진|한도|없는/);
  });

  it('네트워크 오류(status 없음)는 unknown 으로 떨어진다', async () => {
    post.mockRejectedValue(new Error('Failed to fetch'));
    const out = await redeemCoupon('ABCD-EF23-GHJ4');
    expect(out).toMatchObject({ ok: false, failure: 'unknown' });
  });

  it('형식이 틀리면 서버를 부르지 않는다 — 왕복 절약', async () => {
    const out = await redeemCoupon('SHORT');
    expect(out).toMatchObject({ ok: false, failure: 'invalid_format' });
    expect(post).not.toHaveBeenCalled();
  });
});
