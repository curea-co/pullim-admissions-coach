import 'server-only';

import type { FeedbackCategory } from '@pullim/shared';
import {
  isAllowedWebhookHost,
  isInternalHost,
  resolvePublicAddress,
} from '@/lib/webhook-target';

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
  /** loopback 이 아닌데 평문 http — 서비스 키가 그대로 흘러간다. */
  | { ok: false; reason: 'insecure' }
  /** 프로덕션인데 호스트 allowlist 가 없다. */
  | { ok: false; reason: 'allowlist-required' }
  /** 내부망을 가리키거나(이름·DNS 해석) allowlist 밖의 호스트. */
  | { ok: false; reason: 'not-allowed' };

/** user-agent 는 길이 상한이 없는 헤더다. 저장값이 무한정 커지지 않게 잘라 둔다. */
export const FEEDBACK_USER_AGENT_MAX = 512;

/**
 * 전달 대상 구성. **매 호출마다** env 를 다시 읽는다 — 모듈 상수로 굳히면 구성이 바뀐 뒤에도
 * 옛 값으로 돈다(라우트가 `dynamic = 'force-dynamic'` 인 이유와 같다).
 *
 * 이 경로는 `x-service-key` 와 (선언된) 인증 쿠키를 실어 보낸다. 즉 **자격증명이 나가는
 * 주소**라, 값이 잘못 설정되거나 이름이 내부를 가리키면 그 자체가 secret 유출이다.
 * 그래서 웹훅 시절과 같은 검사를 그대로 건다(lib/webhook-target.ts 재사용):
 *   ① 이름이 내부망을 가리키는가 ② 프로덕션은 호스트 allowlist 필수 ③ **DNS 해석 결과**까지
 * loopback 은 같은 기계 안에서 끝나므로 ①~③에서 면제한다(로컬 개발).
 *
 * ⚠️ 남는 한계는 웹훅 때와 같다 — 확인 시점과 연결 시점 사이의 DNS 리바인딩은 연결을 확인한
 * IP 에 고정해야 완전히 닫힌다. 여기서는 fetch 가 다시 해석하므로, 실무 방어는 프로덕션에서
 * **강제되는 allowlist** + 네트워크 이그레스 정책이다.
 */
export async function resolveFeedbackApiTarget(): Promise<FeedbackApiTargetResult> {
  const base = process.env.PULLIM_API_URL?.trim();
  const serviceKey = process.env.FEEDBACK_SERVICE_KEY?.trim();

  const missing: string[] = [];
  if (!base) missing.push('PULLIM_API_URL');
  if (!serviceKey) missing.push('FEEDBACK_SERVICE_KEY');
  if (!base || !serviceKey) return { ok: false, reason: 'not-configured', missing };

  // 베이스는 **URL 로 파싱한 뒤** 경로 위에서만 잇는다. 문자열로 이어 붙이면
  // `https://host/api?v=1` 이 `/api?v=1/feedback` 이 되고(쿼리 안으로 들어간다),
  // `#frag` 는 경로를 통째로 프래그먼트로 삼켜 요청이 엉뚱한 주소로 간다.
  let root: URL;
  try {
    root = new URL(base);
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }
  if (root.protocol !== 'https:' && root.protocol !== 'http:') {
    return { ok: false, reason: 'invalid-url' };
  }
  // 베이스에 쿼리·프래그먼트·인증정보가 붙어 있으면 이어 붙일 수 없거나 자격증명이 함께
  // 나간다. 조용히 무시하지 않고 **구성 오류로 끊는다**(어디로 가는지 모르면 보내지 않는다).
  if (root.search || root.hash || root.username || root.password) {
    return { ok: false, reason: 'invalid-url' };
  }

  // loopback 은 같은 기계 안에서 끝난다 — 평문도, 내부 주소 검사 면제도 여기서만 허용한다.
  // **환경 변수(NODE_ENV)가 아니라 주소로** 가른다: 개발·프리뷰라는 이유로 원격을 열어 두면
  // 그 환경의 서비스 키가 그대로 흘러간다.
  if (!isLoopbackHost(root.hostname)) {
    // 평문 http 로 보내면 `x-service-key` 가 네트워크 위에 그대로 노출된다.
    if (root.protocol !== 'https:') return { ok: false, reason: 'insecure' };

    const allowlist = process.env.FEEDBACK_API_ALLOWED_HOSTS?.trim();
    // 프로덕션은 allowlist 를 **요구한다.** 이름 검사와 DNS 확인만으로는 확인 시점과 연결 시점
    // 사이의 리바인딩을 닫지 못한다. allowlist 를 강제하면 그 틈을 쓰려면 허용된 호스트의 DNS
    // 자체를 장악해야 한다 — 실무에서 이 틈이 닫히는 지점이다.
    if (process.env.NODE_ENV === 'production' && !allowlist) {
      return { ok: false, reason: 'allowlist-required' };
    }
    // 이름이 내부망을 가리키면(사설·링크로컬·루프백·.internal 류) 거기로 자격증명을 보내지 않는다.
    if (isInternalHost(root.hostname)) return { ok: false, reason: 'not-allowed' };
    if (!isAllowedWebhookHost(root.hostname, allowlist)) return { ok: false, reason: 'not-allowed' };
    // 이름이 **실제로 해석되는 주소**까지 본다 — `127.0.0.1.nip.io` 처럼 공인 도메인이 내부를
    // 가리키는 경우는 이름 검사만으로 걸리지 않는다. 해석 실패도 거절한다(모르면 보내지 않는다).
    if (!(await resolvePublicAddress(root.hostname))) return { ok: false, reason: 'not-allowed' };
  }

  // 경로는 **URL 객체의 pathname 에 직접** 넣는다. 상대 참조 문자열로 넘기면(`new URL(path, root)`)
  // `//` 로 시작하는 경로가 **스킴 상대 URL** 로 해석돼 호스트가 통째로 바뀐다 —
  // `https://api.pullim.test//evil.example/x` 가 `https://evil.example/x/feedback` 이 되고,
  // 그 주소로 서비스 키와 인증 쿠키가 나간다. pathname 대입은 origin 을 바꾸지 못한다.
  const path = root.pathname.replace(/\/+$/, '');
  const endpoint = new URL(root);
  endpoint.pathname = `${path}/feedback`;
  const identityEndpoint = new URL(root);
  identityEndpoint.pathname = `${path}/me`;
  // 그래도 한 번 더 확인한다 — 조합 결과가 설정된 호스트를 벗어나면 보내지 않는다.
  if (endpoint.origin !== root.origin || identityEndpoint.origin !== root.origin) {
    return { ok: false, reason: 'invalid-url' };
  }
  return { ok: true, target: { endpoint, identityEndpoint, serviceKey } };
}

/**
 * 같은 기계 안에서 끝나는 주소인가. http 를 허용할 수 있는 **유일한** 경우다.
 * (`*.localhost` 는 RFC 6761 상 loopback 으로 해석된다. IPv6 는 `URL.hostname` 이 대괄호를
 *  붙여 주지만, 직접 넘겨 쓰는 호출도 있어 양쪽 표기를 모두 본다.)
 */
function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '[::1]' || host === '::1') return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
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
 * 읽지 않을 응답 본문을 정리한다.
 *
 * Node(undici)의 fetch 는 본문을 읽거나 취소해야 연결을 풀에 돌려준다. 상태 코드만 보고
 * 그냥 두면 본문을 보내는 업스트림 앞에서 연결이 물린 채 남고, 요청이 반복되면 풀이 고갈된다.
 * (이미 닫힌 본문에 cancel 을 부르면 던질 수 있으므로 삼킨다 — 정리는 실패해도 호출부의
 *  판단을 바꾸지 않는다.)
 */
async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* 이미 닫혔거나 취소된 본문 — 정리할 것이 없다. */
  }
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
  // 응답 본문(`{ id, createdAt }`)은 화면에 쓰지 않는다 — 읽지 않을 것이면 **버려야** 한다.
  await discardBody(res);
  return res.status;
}

/** pullim-api `GET /me` 중 **여기서 쓰는 필드만**. 나머지는 읽지도 않는다. */
interface MeIdentity {
  sub?: unknown;
}

/**
 * api 로 넘길 쿠키만 골라 헤더를 다시 만든다.
 *
 * 받은 `Cookie` 헤더를 통째로 넘기면 **브라우저의 쿠키 격리를 서버가 우회**하게 된다 — 웹
 * 호스트 전용 세션·CSRF·`__Host-*` 쿠키까지 다른 호스트로 함께 나간다. 어떤 쿠키가 인증용인지
 * 코드가 추측하지 않고 **운영자가 선언한다**(FEEDBACK_IDENTITY_COOKIES, 쉼표 구분).
 * 선언이 없으면 아무것도 넘기지 않는다(fail-closed — 그 환경에서는 userId 가 늘 null 이다).
 */
function identityCookieHeader(cookieHeader: string): string | null {
  const declared = process.env.FEEDBACK_IDENTITY_COOKIES?.trim();
  if (!declared) return null;
  const allow = new Set(
    declared
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  if (allow.size === 0) return null;

  const kept = cookieHeader.split(';').filter((part) => {
    const eq = part.indexOf('=');
    return eq > 0 && allow.has(part.slice(0, eq).trim());
  });
  return kept.length > 0 ? kept.map((part) => part.trim()).join('; ') : null;
}

/**
 * 요청자의 userId — **서버에서만** 정한다.
 *
 * 클라이언트가 보낸 id 를 그대로 저장하면 아무나 남의 id 를 붙여 건의를 남길 수 있다. 그래서
 * 신원은 **인증 쿠키로만** 확인한다: 운영자가 선언한 쿠키만 골라 api 에 넘기고, `GET /me` 가
 * 인정하는 `sub` 만 쓴다. 확인되지 않으면 `null` 이다(빈 값 > 위조 가능한 값).
 *
 * ⚠️ 현재 인증 쿠키는 **api 호스트 전용**이라(설계 §7 "Next 미들웨어가 못 읽는다") 웹 호스트로
 * 들어오는 요청에는 실려 오지 않는다 — 즉 지금은 사실상 항상 `null` 이다. 쿠키 도메인이 공유
 * 부모(`Domain=.pullim…`)로 확정되고 운영자가 쿠키 이름을 선언하면 이 경로가 값을 채운다.
 *
 * 실패는 **전부 삼킨다.** 신원 확인이 안 됐다고 건의를 잃게 하지 않는다.
 */
export async function resolveUserId(
  cookieHeader: string | null,
  target: FeedbackApiTarget,
  { timeoutMs, fetchImpl }: SendOptions,
): Promise<string | null> {
  // 쿠키가 아예 없거나 넘길 쿠키가 없으면 확인할 것이 없다 — 왕복을 만들지 않는다.
  if (!cookieHeader) return null;
  const forwarded = identityCookieHeader(cookieHeader);
  if (!forwarded) return null;

  const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
  try {
    const res = await doFetch(target.identityEndpoint, {
      method: 'GET',
      headers: { cookie: forwarded, accept: 'application/json' },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 200) {
      await discardBody(res); // 읽지 않고 끝내는 경로 — 연결을 물고 있지 않게 정리한다
      return null; // 401(미인증)·만료·오류 모두 "모른다" 다
    }
    const body = (await res.json()) as MeIdentity;
    // 문자열 `sub` 만 인정한다. 저장값이 커지지 않게 상한도 둔다.
    return typeof body?.sub === 'string' && body.sub.trim() ? body.sub.trim().slice(0, 128) : null;
  } catch {
    return null;
  }
}
