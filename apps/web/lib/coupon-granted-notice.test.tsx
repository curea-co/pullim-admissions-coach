import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 쿠폰 등록 성공 확인이 **실제로 사용자에게 도달하는지** 고정한다.
//
// 등록에 성공하면 게이트가 재판정되면서 쿠폰 폼(구매 벽이면 벽 전체)이 언마운트된다.
// 그래서 폼 안에서 띄운 "등록됐어요" 는 화면에 남을 시간이 없었고, 사용자는 벽이 사라진
// 것만 보고 방금 한 행동에 대한 확인을 받지 못했다(QA 2026-09-20, 벽·마이페이지 양쪽 재현).
//
// 신호를 폼 바깥(sessionStorage)에 두고, 등록 후 렌더되는 화면이 한 번 소비한다.

import { markCouponGranted, consumeCouponGranted } from './coupon-granted-notice';
import { CouponGrantedNotice } from '../components/auth/coupon-granted-notice';

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('coupon-granted-notice — one-shot 신호', () => {
  it('기록 전에는 소비할 것이 없다', () => {
    expect(consumeCouponGranted()).toBe(false);
  });

  it('기록하면 한 번만 소비된다', () => {
    markCouponGranted();
    expect(consumeCouponGranted()).toBe(true);
    expect(consumeCouponGranted()).toBe(false);
  });

  it('저장이 막혀도(프라이빗 모드) 던지지 않는다 — 알림만 생략된다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => markCouponGranted()).not.toThrow();
  });

  it('읽기가 막혀도 false 로 떨어진다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(consumeCouponGranted()).toBe(false);
  });
});

describe('CouponGrantedNotice — 화면', () => {
  it('신호가 없으면 아무것도 렌더하지 않는다', () => {
    render(<CouponGrantedNotice />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('신호가 있으면 확인 문구를 띄운다', () => {
    markCouponGranted();
    render(<CouponGrantedNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('이용권이 등록됐어요');
  });

  it('한 번 뜨면 신호를 비워 다음 화면에서 또 뜨지 않는다', () => {
    markCouponGranted();
    const first = render(<CouponGrantedNotice />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    first.unmount();

    render(<CouponGrantedNotice />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('닫기 버튼으로 사라진다', () => {
    markCouponGranted();
    render(<CouponGrantedNotice />);
    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
