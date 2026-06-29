'use client';

/**
 * 중앙 로그인(OS) 리다이렉트 — SoT(ADR-010): 로그인/가입 UI는 `os.pullim.ai` 단일(canonical).
 * 개별 서비스는 미인증 시 `${OS}/login?next=<현재 URL>` 로 보내고, 로그인 후 복귀한다.
 *
 * - 로컬 SSO: `NEXT_PUBLIC_OS_URL=http://os.pullim.local:3001` (runbook §2-2).
 * - prod: `https://os.pullim.ai`. 마케팅 apex `pullim.ai` 도 로그인 UI 노출 가능(ADR-010).
 * - **미설정이면 중앙 로그인 비활성** — 단일 호스트/데모 폴백(자체 mock 폼 유지, runbook §6).
 *
 * `next` 는 cross-subdomain(다른 서비스 → OS) 복귀라 **절대 URL**이어야 한다(내부경로 전용
 * `safeNext` 와 별개). 호스트 검증은 OS 측 `REDIRECT_HOST_ALLOWLIST`(`*.pullim.local`/`*.pullim.ai`)가 한다.
 */

const OS_URL = process.env.NEXT_PUBLIC_OS_URL ?? '';

/** 중앙 로그인 모드 여부(OS 베이스 URL 설정 시에만 켜짐). */
export function isOsAuthEnabled(): boolean {
  return OS_URL !== '';
}

/** next 후보를 절대 URL로 정규화(내부 경로 → 현재 오리진 기준 절대화). */
function absoluteNext(next?: string | null): string {
  if (typeof window === 'undefined') return next ?? '/';
  if (!next) return window.location.href;
  if (/^https?:\/\//i.test(next)) return next; // 이미 절대 URL
  try {
    return new URL(next, window.location.origin).href;
  } catch {
    return window.location.href;
  }
}

/** OS 로그인/가입 URL. `next`=로그인 후 복귀 대상(기본=현재 URL). */
export function osAuthUrl(kind: 'login' | 'signup', next?: string | null): string {
  return `${OS_URL}/${kind}?next=${encodeURIComponent(absoluteNext(next))}`;
}

/** OS 로그인/가입으로 전체 페이지 이동(cross-origin이라 router 아님). */
export function redirectToOsAuth(kind: 'login' | 'signup', next?: string | null): void {
  if (typeof window === 'undefined') return;
  window.location.assign(osAuthUrl(kind, next));
}
