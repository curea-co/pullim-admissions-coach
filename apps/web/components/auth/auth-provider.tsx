'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { auth, type User } from '@/lib/auth';
import { setUserScope } from '@/lib/result';
import { clearAdmissionsAccessCache } from '@/lib/admissions-api';

// 'error' = getMe가 예외를 던짐(서버/네트워크/DTO). 401 만료는 어댑터가 null로 주므로
// 'guest'다. 'error'는 로그아웃이 아니므로 /login 강제 리다이렉트하지 않는다(RequireAuth).
type Status = 'loading' | 'authed' | 'guest' | 'error';
type Ctx = { user: User | null; status: Status; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const started = ++generation.current;
    const identity = api.generation();
    // 엔타이틀먼트 캐시 무효화 — 로그인/로그아웃(사용자 전환) 시 이전 사용자 admissions 판정이
    // 남지 않게(교차사용자 격리). 이후 게이트가 새 사용자로 재조회.
    clearAdmissionsAccessCache();
    try {
      const u = await auth.getMe();
      if (started !== generation.current || identity !== api.generation()) return;
      setUser(u); setStatus(u ? 'authed' : 'guest');
      // 결과 저장 스코프를 현재 사용자로 동기화(C: 교차사용자 격리). 비로그인=null→익명 스코프.
      setUserScope(u?.id ?? null);
    } catch {
      if (started !== generation.current || identity !== api.generation()) return;
      // getMe 예외 = 401 만료가 아니라 서버/네트워크/DTO 오류(어댑터가 401은 null로 변환).
      // 로그아웃이 아니므로 'guest'(→/login)로 강등하지 않고 'error'로 둔다(일시 장애에
      // 사용자를 로그아웃시키지 않음). 단, 이전 사용자 스코프가 남지 않게 즉시 해제(격리).
      setUser(null); setStatus('error'); setUserScope(null);
    }
  }, []);
  // 로그아웃: 스코프를 먼저 해제(즉시 격리)하고, auth.logout()이 실패해도 refresh가
  // 반드시 실행되도록 finally로 보장한다 — 안 그러면 user/status는 이전 로그인 상태로
  // 남고 스코프만 풀리는 불일치가 생긴다.
  const logout = useCallback(async () => {
    setUserScope(null);
    try {
      await auth.logout();
    } finally {
      await refresh();
    }
  }, [refresh]);
  useEffect(() => {
    const unsubscribe = api.subscribeExpired(() => {
      generation.current += 1;
      clearAdmissionsAccessCache();
      setUserScope(null);
      setUser(null);
      setStatus('guest');
    });
    void refresh();
    return () => { generation.current += 1; unsubscribe(); };
  }, [refresh]);
  return <AuthCtx.Provider value={{ user, status, refresh, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
