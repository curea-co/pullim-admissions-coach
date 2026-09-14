import 'server-only';

import type { FeedbackCategory } from '@pullim/shared';

// 건의 저장 — pullim-api 의 `POST /feedback` 표면.
//
// 왜 저장인가: 건의는 운영자가 pullim-admin 화면에서 **다시 열어 볼 수 있어야** 한다. 알림만
// 던지고 마는 경로는 지나가면 사라져 그 목적을 못 채운다.
//
// 이 모듈이 감추는 것: 엔드포인트 주소와 서비스 키. 둘 다 **서버 전용 env** 라 브라우저 번들에
// 들어가면 안 된다(`server-only` 가 그 실수를 빌드 타임에 잡는다). 라우트는 이 모듈만 부른다.
//
// 정직성 규칙(§6 — 가짜 상태 금지): 저장에 성공했을 때만 성공이다. 구성이 없으면 501,
// api 가 받지 못하면 502 — 조용히 버리고 200 을 주지 않는다.

/** 저장 계약 — **여기 선언된 필드만** 보낸다. */
export interface FeedbackApiPayload {
  /** 어느 서비스에서 온 건의인가. 입시코치는 고정값이다. */
  service: 'admissions';
  category: FeedbackCategory;
  content: string;
  /**
   * 요청자 식별자. **서버가 정한 값만** 들어간다(클라이언트가 보낸 id 는 위조 가능하므로 쓰지
   * 않는다). 확인할 수 없으면 `null` — 빈 값이 가짜 값보다 낫다.
   */
  userId: string | null;
  /**
   * 제출 맥락. **모르는 필드는 넣지 않는다**(빈 문자열·'unknown' 같은 가짜 값 금지).
   * 이름·이메일·등급·미성년 여부는 어떤 경우에도 담지 않는다(오너 결정: userId 만 저장).
   */
  context: {
    /** 제출 시점 경로(`pathname + search`). 호스트는 담지 않는다 — api 가 이미 안다. */
    pageUrl?: string;
    /** 서버가 요청 헤더에서 읽은 값(클라이언트가 보낸 값보다 신뢰도가 높다). */
    userAgent?: string;
    viewport?: { w: number; h: number };
    /** 빌드 식별자. 확인할 수 없는 환경에서는 **필드 자체를 생략한다.** */
    appVersion?: string;
  };
}

export interface FeedbackApiTarget {
  /** 건의를 저장할 절대 주소 — `{PULLIM_API_URL}/feedback`. */
  endpoint: URL;
  /** 신원 확인 주소 — `{PULLIM_API_URL}/me`. 베이스 경로를 공유한다. */
  identityEndpoint: URL;
  /** `x-service-key` 헤더로 보낼 값. */
  serviceKey: string;
}

export type FeedbackApiTargetResult =
  | { ok: true; target: FeedbackApiTarget }
  /** env 가 비어 있다 — 어느 것이 비었는지 라우트가 그대로 말해 준다. */
  | { ok: false; reason: 'not-configured'; missing: string[] }
  /** 주소가 URL 이 아니거나 http(s) 가 아니다. */
  | { ok: false; reason: 'invalid-url' }
  /** 프로덕션인데 평문 http — 서비스 키가 그대로 흘러간다. */
  | { ok: false; reason: 'insecure' };

/** user-agent 는 길이 상한이 없는 헤더다. 저장값이 무한정 커지지 않게 잘라 둔다. */
export const FEEDBACK_USER_AGENT_MAX = 512;

/**
 * 전달 대상 구성. **매 호출마다** env 를 다시 읽는다 — 모듈 상수로 굳히면 구성이 바뀐 뒤에도
 * 옛 값으로 돈다(라우트가 `dynamic = 'force-dynamic'` 인 이유와 같다).
 */
export function resolveFeedbackApiTarget(): FeedbackApiTargetResult {
  const base = process.env.PULLIM_API_URL?.trim();
  const serviceKey = process.env.FEEDBACK_SERVICE_KEY?.trim();

  const missing: string[] = [];
  if (!base) missing.push('PULLIM_API_URL');
  if (!serviceKey) missing.push('FEEDBACK_SERVICE_KEY');
  if (!base || !serviceKey) return { ok: false, reason: 'not-configured', missing };

  // 베이스의 경로를 **보존해서** 잇는다. `new URL('/feedback', base)` 는 base 가
  // `https://host/api` 일 때 `/api` 를 버린다.
  const root = base.replace(/\/+$/, '');
  let endpoint: URL;
  let identityEndpoint: URL;
  try {
    endpoint = new URL(`${root}/feedback`);
    identityEndpoint = new URL(`${root}/me`);
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }
  if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') {
    return { ok: false, reason: 'invalid-url' };
  }
  // 평문 http 로 보내면 `x-service-key` 가 경로 위에 그대로 노출된다. 로컬(dev) 은 그 위험이
  // 없으니 허용하고, 프로덕션에서는 거절한다 — 열어 두는 대신 원인을 말하고 멈춘다.
  if (process.env.NODE_ENV === 'production' && endpoint.protocol !== 'https:') {
    return { ok: false, reason: 'insecure' };
  }

  return { ok: true, target: { endpoint, identityEndpoint, serviceKey } };
}

/**
 * 빌드 식별자. Vercel 이 주입하는 커밋 SHA 를 쓰고, 다른 환경(ECS 등)은 운영자가 `APP_VERSION`
 * 으로 선언한다. **둘 다 없으면 `undefined`** — 추측한 버전을 저장하면 그 값으로 추적한 사람이
 * 잘못된 결론에 이른다.
 */
export function appVersion(): string | undefined {
  return process.env.APP_VERSION?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || undefined;
}

interface SendOptions {
  timeoutMs: number;
  /** 테스트 주입용. 기본 전역 fetch(호출 시점에 바인딩 — stubGlobal 이 먹어야 한다). */
  fetchImpl?: typeof fetch;
}

/**
 * 건의 한 건을 api 에 저장한다. 반환은 **응답 상태 코드**이고 성공/실패 판단은 호출부가 한다
 * (2xx 만 성공). 연결 실패·타임아웃은 reject.
 */
export async function postFeedbackToApi(
  target: FeedbackApiTarget,
  payload: FeedbackApiPayload,
  { timeoutMs, fetchImpl }: SendOptions,
): Promise<number> {
  const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
  const res = await doFetch(target.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-service-key': target.serviceKey,
    },
    body: JSON.stringify(payload),
    // 리다이렉트를 따라가지 않는다. 따라가면 서비스 키가 **다른 호스트로** 다시 나가고,
    // 3xx 를 성공으로 착각하게 된다 — 여기서는 3xx 가 그대로 돌아와 실패로 처리된다.
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res.status;
}

/** pullim-api `GET /me` 중 **여기서 쓰는 필드만**. 나머지는 읽지도 않는다. */
interface MeIdentity {
  sub?: unknown;
}

/**
 * 요청자의 userId — **서버에서만** 정한다.
 *
 * 클라이언트가 보낸 id 를 그대로 저장하면 아무나 남의 id 를 붙여 건의를 남길 수 있다. 그래서
 * 신원은 **인증 쿠키로만** 확인한다: 요청에 실려 온 쿠키를 그대로 api 에 넘겨 `GET /me` 가
 * 인정하는 `sub` 만 쓴다. 확인되지 않으면 `null` 이다(빈 값 > 위조 가능한 값).
 *
 * ⚠️ 현재 인증 쿠키는 **api 호스트 전용**이라(설계 §7 "Next 미들웨어가 못 읽는다") 웹 호스트로
 * 들어오는 요청에는 실려 오지 않는다 — 즉 지금은 사실상 항상 `null` 이다. 쿠키 도메인이 공유
 * 부모(`Domain=.pullim…`)로 확정되면 이 경로가 그대로 값을 채운다.
 *
 * 실패는 **전부 삼킨다.** 신원 확인이 안 됐다고 건의를 잃게 하지 않는다.
 */
export async function resolveUserId(
  cookieHeader: string | null,
  target: FeedbackApiTarget,
  { timeoutMs, fetchImpl }: SendOptions,
): Promise<string | null> {
  // 쿠키가 아예 없으면 확인할 것이 없다 — 왕복을 만들지 않는다.
  if (!cookieHeader) return null;

  const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
  try {
    const res = await doFetch(target.identityEndpoint, {
      method: 'GET',
      headers: { cookie: cookieHeader, accept: 'application/json' },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 200) return null; // 401(미인증)·만료·오류 모두 "모른다" 다
    const body = (await res.json()) as MeIdentity;
    // 문자열 `sub` 만 인정한다. 저장값이 커지지 않게 상한도 둔다.
    return typeof body?.sub === 'string' && body.sub.trim() ? body.sub.trim().slice(0, 128) : null;
  } catch {
    return null;
  }
}
