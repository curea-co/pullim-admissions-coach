// 로그인 버튼 → 풀림 OS 로그인으로 리다이렉트(서브도메인 SSO).
//
// 복귀 경로는 `next` 쿼리로 넘긴다 — 파라미터명은 OS 로그인 페이지(pullim-web LoginClient.tsx)가
// 실제로 읽는 값(`params.get('next')`, 2026-06 코드 확인)과 일치시킨다.
//
// 값은 입시코치의 **전체 현재 URL**(cross-service 복귀용). OS 측 복귀 처리(승훈)가 이 외부 URL을
// 받아 로그인 후 되돌려보낸다. (현재 OS resolveNext는 동일출처 경로만 허용하므로, 외부 복귀 지원은
// OS 측 후속 작업 — 입시코치는 규약대로 next에 복귀 URL을 실어 보낸다.)
//
// NEXT_PUBLIC_OS_URL 미설정 시 null → 호출부가 내부 /login(mock)으로 폴백(모드 안전).

/**
 * OS 로그인 URL(`{NEXT_PUBLIC_OS_URL}/login?next=<returnUrl>`)을 만든다.
 * @param returnUrl 로그인 후 돌아올 입시코치 절대 URL(보통 window.location.href)
 * @returns SSO 로그인 URL, 또는 NEXT_PUBLIC_OS_URL 미설정 시 null
 */
export function osLoginHref(returnUrl: string): string | null {
  const base = process.env.NEXT_PUBLIC_OS_URL;
  if (!base) return null;
  const url = new URL('/login', base);
  url.searchParams.set('next', returnUrl);
  return url.toString();
}
