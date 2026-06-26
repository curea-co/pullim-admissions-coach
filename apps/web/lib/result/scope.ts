'use client';

// 저장 격리 스코프(사용자별) — 교차사용자 노출 차단.
// 지금은 mock 세션(localStorage 'puds-auth-session')을 읽는다.
// B(실 인증) 연동 시: auth-provider가 로그인/로그아웃에서 setUserScope(user.id | null)를
// 호출하도록 연결하면 실제 사용자 id 기준으로 격리된다(override 우선).

const MOCK_SESSION_KEY = 'puds-auth-session';
const ANON_KEY = 'pullim:anon-scope';

// undefined = 미설정(setUserScope 호출 전) → mock 세션 폴백 허용.
// null       = 명시적 익명(로그아웃/실패) → 세션 폴백 없이 익명 스코프 강제.
// string     = 로그인 사용자 id.
let override: string | null | undefined = undefined;

/** B 연동 시 실제 user id 주입(로그아웃/실패 시 null=명시적 익명). */
export function setUserScope(userId: string | null): void {
  override = userId;
}

/**
 * 비로그인 스코프 — **탭 세션별로** 격리(sessionStorage). 모든 익명 사용자를 하나의
 * 'anon'으로 묶으면 공용 브라우저에서 익명 사용자 간 교차 노출이 생기므로,
 * 탭 세션마다 임의 id를 부여한다(탭 종료 시 소멸).
 */
function anonScope(): string {
  try {
    let id = sessionStorage.getItem(ANON_KEY);
    if (!id) {
      id = `anon_${crypto.randomUUID()}`;
      sessionStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

/** 현재 사용자 스코프 키. 로그인=user id, 명시적 익명/비로그인=탭 세션별 익명 id. */
export function currentScope(): string {
  // 명시적으로 설정된 경우(로그인 id 또는 null=익명): 세션 폴백 없이 그대로 따른다.
  if (override !== undefined) {
    return override ?? anonScope();
  }
  // 미설정(앱 초기/인증 프로바이더 마운트 전) — 편의상 mock 세션을 읽어본다.
  try {
    const session = localStorage.getItem(MOCK_SESSION_KEY);
    if (session) return session;
  } catch {
    // localStorage 비가용 — 익명 스코프로.
  }
  return anonScope();
}
