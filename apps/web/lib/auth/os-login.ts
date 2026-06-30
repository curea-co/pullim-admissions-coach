// 로그인 버튼 → 풀림 OS 로그인으로 리다이렉트(서브도메인 SSO).
//
// 복귀 경로는 `next` 쿼리로 넘긴다 — 파라미터명은 OS 로그인 페이지(pullim-web LoginClient.tsx)가
// 실제로 읽는 값(`params.get('next')`, 2026-06 코드 확인)과 일치시킨다.
//
// 값은 입시코치의 **전체 현재 URL**(cross-service 복귀용). OS resolveNext(pullim-web)가 allowlist된
// 풀림 호스트(local `*.pullim.local`, prod `*.pullim.ai`) 절대 URL 복귀를 허용하므로 로그인 후 되돌아온다.
//
// **NEXT_PUBLIC_OS_URL 이 곧 feature flag** — OS가 cross-service 복귀를 지원하는 환경에서만 설정한다.
// 미설정 시 null → 호출부가 내부 /login(mock)으로 폴백(모드 안전). 또 OS 복귀가 미허용이어도
// resolveNext 가 osUrl()로 폴백할 뿐(로그인 쿠키는 SSO로 이미 발급) — 인증은 깨지지 않고 복귀만 생략된다.

/**
 * OS 로그인 URL(`{NEXT_PUBLIC_OS_URL}/login?next=<returnUrl>`)을 만든다.
 * @param returnUrl 로그인 후 돌아올 입시코치 절대 URL(보통 window.location.href)
 * @returns SSO 로그인 URL, 또는 NEXT_PUBLIC_OS_URL 미설정 시 null
 */
export function osLoginHref(returnUrl: string): string | null {
  return osAuthHref('/login', returnUrl);
}

/**
 * OS 가입 URL(`{NEXT_PUBLIC_OS_URL}/signup?next=<returnUrl>`)을 만든다.
 * 가입도 OS(pullim-web)가 정본 — 입시코치 내부 mock /signup 대신 SSO 가입으로 보낸다.
 * @returns SSO 가입 URL, 또는 NEXT_PUBLIC_OS_URL 미설정 시 null(호출부가 내부 /signup mock 폴백).
 */
export function osSignupHref(returnUrl: string): string | null {
  return osAuthHref('/signup', returnUrl);
}

function osAuthHref(path: string, returnUrl: string): string | null {
  const base = process.env.NEXT_PUBLIC_OS_URL;
  if (!base) return null;
  try {
    const url = new URL(path, base);
    url.searchParams.set('next', returnUrl);
    return url.toString();
  } catch {
    // base 형식 오류(스킴 누락 'os.pullim.ai' 등) → null → 호출부가 내부 mock으로 폴백.
    return null;
  }
}
