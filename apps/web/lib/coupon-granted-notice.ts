'use client';

/**
 * 쿠폰 등록 성공 알림 — **한 번만 뜨는** 신호.
 *
 * 왜 별도 저장소가 필요한가: 등록에 성공하면 `onGranted()` → 게이트 재판정 →
 * `admissions === 'has'` 가 되면서 **쿠폰 폼(구매 벽이면 벽 전체)이 언마운트된다.**
 * 그래서 폼 안에서 `setState` 로 띄운 "등록됐어요" 는 화면에 남을 시간이 없다.
 * 사용자는 벽이 사라진 것만 보고, 방금 한 행동에 대한 확인을 받지 못한다(QA 2026-09-20).
 *
 * 신호를 폼 바깥에 두고, 등록 후 실제로 렌더되는 화면이 그것을 소비해 한 번 보여준다.
 *
 * `sessionStorage` 를 쓰는 이유:
 *  · 탭을 닫으면 사라진다 — 다음 방문에 뒤늦게 뜨는 사고가 구조적으로 없다.
 *  · 벽에서 등록하면 그 자리에서 `/submit` 이 렌더되지만, 마이페이지 경로나 새로고침을
 *    거치는 경우도 있어 컴포넌트 state 로는 건너오지 못한다.
 *
 * 프라이빗 모드·차단 환경에서는 저장이 실패할 수 있다. 그때는 **알림만 생략**된다 —
 * 이용권 자체는 서버가 정본이라 아무것도 깨지지 않는다.
 */

const KEY = 'admissions-coupon-granted';

/** 등록 성공을 기록한다. 실패해도 조용히 넘어간다(알림은 부가 기능). */
export function markCouponGranted(): void {
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    // 저장 불가(프라이빗 모드 등) — 알림만 생략된다.
  }
}

/**
 * 기록을 **읽고 즉시 지운다**(one-shot). 같은 세션에서 화면을 옮겨다녀도 두 번 뜨지 않는다.
 * @returns 방금 등록에 성공했으면 true
 */
export function consumeCouponGranted(): boolean {
  try {
    if (window.sessionStorage.getItem(KEY) !== '1') return false;
    window.sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
