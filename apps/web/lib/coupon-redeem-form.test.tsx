import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 쿠폰 폼 배선 회귀 — 클라이언트 단위 테스트(coupon-api.test.ts)가 덮지 못하는 화면 쪽 계약을 고정한다.
//
// 가장 중요한 건 **성공했는데 안 열리는 경우**다. 다른 서비스 쿠폰은 서버가 200 을 주지만
// admissions grant 가 없어 입시코치는 계속 막힌다. 그때 초록색 "등록됐어요" 만 띄우면 사용자가
// 자기 상태를 이해할 수 없다 — 문구가 갈리는지, onGranted 가 안 불리는지를 둘 다 본다.

const redeemCoupon = vi.fn();
const clearAdmissionsAccessCache = vi.fn();
const markCouponGranted = vi.fn();

vi.mock('@/lib/coupon-api', async () => {
  // 형식 검사는 진짜를 쓴다 — 제출 버튼 활성 조건이 서버 패턴과 어긋나는지도 같이 잡힌다.
  const actual = await vi.importActual<typeof import('./coupon-api')>('./coupon-api');
  return { ...actual, redeemCoupon: (code: string) => redeemCoupon(code) };
});

vi.mock('@/lib/admissions-api', () => ({
  clearAdmissionsAccessCache: () => clearAdmissionsAccessCache(),
}));

vi.mock('@/lib/coupon-granted-notice', () => ({ markCouponGranted: () => markCouponGranted() }));

import { CouponRedeemForm } from '../components/auth/coupon-redeem-form';

const input = () => screen.getByLabelText('쿠폰이 있나요?');
const submit = () => screen.getByRole('button', { name: /등록/ });
const type = (v: string) => fireEvent.change(input(), { target: { value: v } });

beforeEach(() => {
  vi.clearAllMocks();
  redeemCoupon.mockResolvedValue({ ok: true, admissionsGranted: true, grants: [] });
});

describe('CouponRedeemForm — 제출 가드', () => {
  it('빈 입력에서는 등록 버튼이 비활성이다', () => {
    render(<CouponRedeemForm />);
    expect(submit()).toBeDisabled();
  });

  it('형식 미달(11자)에서는 여전히 비활성 — 서버 패턴과 같은 기준', () => {
    render(<CouponRedeemForm />);
    type('ABCDEFGHIJK');
    expect(submit()).toBeDisabled();
  });

  it('유효한 코드면 활성화된다', () => {
    render(<CouponRedeemForm />);
    type('ABCD-EF23-GHJ4');
    expect(submit()).toBeEnabled();
  });
});

describe('CouponRedeemForm — 결과 분기', () => {
  it('성공하면 확인 신호를 폼 바깥에 남긴다 — 이 컴포넌트는 곧 언마운트된다', async () => {
    render(<CouponRedeemForm onGranted={vi.fn()} />);
    type('ABCD-EF23-GHJ4');
    fireEvent.click(submit());
    await waitFor(() => expect(markCouponGranted).toHaveBeenCalledTimes(1));
  });

  it('실패하면 신호를 남기지 않는다', async () => {
    redeemCoupon.mockResolvedValue({ ok: false, failure: 'not_redeemable', message: 'x' });
    render(<CouponRedeemForm />);
    type('ABCD-EF23-GHJ4');
    fireEvent.click(submit());
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(markCouponGranted).not.toHaveBeenCalled();
  });

  it('다른 서비스 쿠폰도 신호를 남기지 않는다', async () => {
    redeemCoupon.mockResolvedValue({ ok: true, admissionsGranted: false, grants: [] });
    render(<CouponRedeemForm />);
    type('ABCD-EF23-GHJ4');
    fireEvent.click(submit());
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(markCouponGranted).not.toHaveBeenCalled();
  });

  it('admissions 가 붙으면 성공 문구 + 캐시 무효화 + onGranted 호출', async () => {
    const onGranted = vi.fn();
    render(<CouponRedeemForm onGranted={onGranted} />);
    type('ABCD-EF23-GHJ4');
    fireEvent.click(submit());

    await waitFor(() => expect(onGranted).toHaveBeenCalledTimes(1));
    expect(clearAdmissionsAccessCache).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('이용권이 등록됐어요');
  });

  it('성공하면 입력값을 비운다 — 같은 코드를 다시 눌러 409 를 부르지 않게', async () => {
    render(<CouponRedeemForm />);
    type('ABCD-EF23-GHJ4');
    fireEvent.click(submit());
    await waitFor(() => expect(input()).toHaveValue(''));
  });

  it('다른 서비스 쿠폰: 등록은 됐지만 입시 이용권이 아니라고 말하고 onGranted 는 부르지 않는다', async () => {
    redeemCoupon.mockResolvedValue({ ok: true, admissionsGranted: false, grants: [] });
    const onGranted = vi.fn();
    render(<CouponRedeemForm onGranted={onGranted} />);
    type('ABCD-EF23-GHJ4');
    fireEvent.click(submit());

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('입시 이용권은 아니에요')
    );
    expect(onGranted).not.toHaveBeenCalled();
    expect(clearAdmissionsAccessCache).not.toHaveBeenCalled();
  });

  it('실패하면 서버 문장을 그대로 띄우고 게이트를 건드리지 않는다', async () => {
    redeemCoupon.mockResolvedValue({
      ok: false,
      failure: 'already_redeemed',
      message: '이미 사용한 쿠폰입니다.',
    });
    const onGranted = vi.fn();
    render(<CouponRedeemForm onGranted={onGranted} />);
    type('ABCD-EF23-GHJ4');
    fireEvent.click(submit());

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('이미 사용한 쿠폰입니다.')
    );
    expect(onGranted).not.toHaveBeenCalled();
    expect(input()).toHaveValue('ABCD-EF23-GHJ4'); // 실패 시 입력은 남긴다(수정해서 재시도)
  });

  it('코드를 다시 고치면 이전 에러 문구가 사라진다', async () => {
    redeemCoupon.mockResolvedValue({
      ok: false,
      failure: 'not_redeemable',
      message: '쿠폰을 사용할 수 없습니다. 코드를 다시 확인해 주세요.',
    });
    render(<CouponRedeemForm />);
    type('ABCD-EF23-GHJ4');
    fireEvent.click(submit());
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    type('ABCD-EF23-GHJ5');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('전송 중에는 버튼이 잠긴다 — 중복 제출로 409 를 만들지 않게', async () => {
    let release: (v: unknown) => void = () => {};
    redeemCoupon.mockReturnValue(new Promise((r) => (release = r)));
    render(<CouponRedeemForm />);
    type('ABCD-EF23-GHJ4');
    fireEvent.click(submit());

    await waitFor(() => expect(submit()).toBeDisabled());
    expect(submit()).toHaveTextContent('등록 중…');
    release({ ok: true, admissionsGranted: true, grants: [] });
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });
});
