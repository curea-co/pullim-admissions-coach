/**
 * `?next=` 오픈 리다이렉트 가드 (auth 설계 §5).
 * 내부 경로만 허용한다 — 외부 URL/프로토콜-상대(`//`)/스킴 포함 값은 기본값으로 폴백.
 *
 * 허용: `/mypage`, `/submit?x=1`
 * 차단: `//evil.com`, `https://evil.com`, `http:evil`, `javascript:…`, 비-`/` 시작.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  // 반드시 단일 `/`로 시작. 절대 URL(`https://…`)은 `/` 시작이 아니라 자동 차단.
  if (!next.startsWith('/')) return fallback;
  // 프로토콜-상대(`//evil.com`)와 백슬래시 우회(`/\evil.com`) 차단.
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
