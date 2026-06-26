'use client';

// 저장 격리 스코프(사용자별) — 교차사용자 노출 차단.
// 지금은 mock 세션(localStorage 'puds-auth-session')을 읽는다.
// B(실 인증) 연동 시: auth-provider가 로그인/로그아웃에서 setUserScope(user.id | null)를
// 호출하도록 연결하면 실제 사용자 id 기준으로 격리된다(override 우선).

const MOCK_SESSION_KEY = 'puds-auth-session';

let override: string | null = null;

/** B 연동 시 실제 user id 주입(로그아웃 시 null). */
export function setUserScope(userId: string | null): void {
  override = userId;
}

/** 현재 사용자 스코프 키. 비로그인/미상은 'anon'. */
export function currentScope(): string {
  if (override) return override;
  try {
    return localStorage.getItem(MOCK_SESSION_KEY) || 'anon';
  } catch {
    return 'anon';
  }
}
