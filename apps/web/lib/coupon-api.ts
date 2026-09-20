'use client';

/**
 * 쿠폰 등록 클라이언트 — `POST /billing/coupons/redeem` (pullim-api `src/billing/modules/coupon`).
 *
 * 왜 이 경로가 필요한가: 입시코치는 `admissions` 이용권 보유자만 쓸 수 있는데(lib/admissions-api.ts),
 * OS 상품 카탈로그의 결제 딥링크가 아직 없다. 쿠폰은 **지금 동작하는 유일한 이용권 획득 경로**다.
 * 등록이 성공하면 auth 가 `service_grants` 를 발급하고 `ent_epoch` 를 올린다. 엔타이틀먼트 flags 는
 * `max(패키지 번들, per-user override, 활성 grant)` 로 해소되고 `GET /me/entitlements` 가 같은
 * resolver 를 쓰므로, admissions grant 가 붙으면 구매 벽이 실제로 열린다.
 *
 * 전송은 lib/api.ts 재사용(CSRF·쿠키·401 refresh). 서버는 쿠키 인증 + CsrfGuard + USER 권한이다.
 */

import { api } from '@/lib/api';
import type { ApiError } from '@/lib/api';

/** 입시코치가 여는 데 필요한 서비스 키. auth `ENTITLEMENT_SERVICE_KEYS` 의 값(구 `exam`, 2026-07-06 rename). */
export const ADMISSIONS_SERVICE_KEY = 'admissions';

/**
 * 평문 쿠폰 코드 형식 — 서버 `RedeemCouponDto` 의 `@Matches` 와 **같은 패턴**이다.
 * 내부 생성 코드(`XXXX-XXXX-XXXX`)와 외부 업체 발급 코드를 모두 수용한다.
 * 12자 하한은 brute-force 방어용 엔트로피 floor라 클라에서 임의로 낮추지 않는다.
 */
export const COUPON_CODE_PATTERN = /^[A-Za-z0-9-]{12,64}$/;

/** `RedeemCouponResponseDto.grants[]` — 이번 등록으로 붙은 서비스 grant 1건. */
export interface RedeemGrant {
  service: string;
  level: number;
  expiresAt: string;
}

/** `POST /billing/coupons/redeem` 200 응답. `credit` 은 등급-전용 쿠폰에서 null(ADR-059). */
export interface RedeemCouponResponse {
  grants: RedeemGrant[];
  credit: { amount: number; expiresAt: string | null } | null;
}

/**
 * 등록 실패 사유 — **HTTP 상태로만** 판정한다.
 *
 * 서버 전역 필터는 Nest 기본 모양(`{statusCode, message, error}`)을 유지하고 **403 에만** `code` 를
 * 붙인다(`http-exception-logging.filter.ts`). 즉 400·404·409 에는 기계 판독 코드가 없다. 메시지 문구로
 * 분기하면 레포가 달라 문안을 다듬는 순간 조용히 깨지므로(lib/api.ts `ApiError.code` 주석), 여기서는
 * 상태코드를 분기 축으로 쓴다 — 다섯 상태가 서로 다른 결과에 1:1 대응해 충분하다.
 */
export type CouponFailure =
  | 'invalid_format' // 400 — 코드 형식 위반
  | 'unauthenticated' // 401 — 비회원·세션 만료
  | 'not_eligible' // 403 — usage_scope(연령·본인인증) 미충족
  | 'not_redeemable' // 404 — 없음·만료·한도 소진(사유 구분 노출 금지)
  | 'already_redeemed' // 409 — 본인이 이미 등록(캠페인 단위 1인 1회)
  | 'unknown'; // 5xx·네트워크

/**
 * 등록 결과. 성공이어도 **입시코치가 열렸다는 뜻은 아니다** — `admissionsGranted` 를 봐야 한다.
 * 다른 서비스(q·planner 등) 쿠폰을 넣으면 서버는 200 을 주지만 입시코치는 계속 막힌다.
 */
export type RedeemOutcome =
  | { ok: true; admissionsGranted: boolean; grants: RedeemGrant[] }
  | { ok: false; failure: CouponFailure; message: string };

/** 상태코드 → 사유. 매핑에 없는 상태(5xx·0)는 unknown 으로 떨어뜨린다. */
function failureFromStatus(status: number): CouponFailure {
  switch (status) {
    case 400:
      return 'invalid_format';
    case 401:
      return 'unauthenticated';
    case 403:
      return 'not_eligible';
    case 404:
      return 'not_redeemable';
    case 409:
      return 'already_redeemed';
    default:
      return 'unknown';
  }
}

/**
 * 사용자에게 보일 문장.
 *
 * 404 는 **사유를 구분하지 않는다** — 서버가 없음·만료·한도소진을 한 문장으로 통일한 것은
 * enumeration 저항(코드 존재 여부를 브루트포스로 캐지 못하게)이 목적이다. 화면에서 "만료된 것
 * 같아요" 처럼 추측을 덧붙이면 그 방어가 무의미해지므로 서버 문장을 그대로 쓴다.
 *
 * @param serverMessage 서버가 준 문장(있으면 우선). 없거나 비면 아래 기본 문장.
 */
function messageFor(failure: CouponFailure, serverMessage?: string): string {
  if (serverMessage && serverMessage.trim()) return serverMessage;
  switch (failure) {
    case 'invalid_format':
      return '올바르지 않은 쿠폰 코드입니다.';
    case 'unauthenticated':
      return '로그인이 필요합니다.';
    case 'not_eligible':
      return '이 쿠폰을 사용할 수 있는 조건이 아니에요.';
    case 'not_redeemable':
      return '쿠폰을 사용할 수 없습니다. 코드를 다시 확인해 주세요.';
    case 'already_redeemed':
      return '이미 사용한 쿠폰입니다.';
    default:
      return '쿠폰을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
}

/**
 * 제출 전 형식 검사 — 서버 DTO 와 같은 패턴이라 형식 오류는 왕복 없이 잡는다.
 * 대문자 정규화는 하지 않는다: 서버 패턴이 대소문자를 모두 받고 코드를 **평문 그대로** 조회하므로
 * 클라가 대문자로 바꾸면 소문자 코드를 발급한 외부 업체 쿠폰이 404 로 떨어진다.
 */
export function isValidCouponCode(code: string): boolean {
  return COUPON_CODE_PATTERN.test(code.trim());
}

/**
 * 쿠폰을 등록한다. 던지지 않고 결과 객체로 돌려준다 — 호출부가 다섯 실패 분기를 모두 화면 문구로
 * 처리해야 해서, try/catch 안에서 상태코드를 다시 읽게 만들 이유가 없다.
 */
export async function redeemCoupon(code: string): Promise<RedeemOutcome> {
  const trimmed = code.trim();
  if (!isValidCouponCode(trimmed)) {
    return {
      ok: false,
      failure: 'invalid_format',
      message: messageFor('invalid_format'),
    };
  }

  try {
    const res = await api.post<RedeemCouponResponse>('/billing/coupons/redeem', {
      code: trimmed,
    });
    const grants = res?.grants ?? [];
    return {
      ok: true,
      admissionsGranted: grants.some(
        (g) => g.service === ADMISSIONS_SERVICE_KEY && g.level >= 1
      ),
      grants,
    };
  } catch (e) {
    const err = e as ApiError;
    const failure = failureFromStatus(err?.status ?? 0);
    return { ok: false, failure, message: messageFor(failure, err?.message) };
  }
}
