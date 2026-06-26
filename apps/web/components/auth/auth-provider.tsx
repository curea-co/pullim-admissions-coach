'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, type User } from '@/lib/auth';
import { setUserScope } from '@/lib/result';

// 'error' = getMe가 예외를 던짐(서버/네트워크/DTO). 401 만료는 어댑터가 null로 주므로
// 'guest'다. 'error'는 로그아웃이 아니므로 /login 강제 리다이렉트하지 않는다(RequireAuth).
type Status = 'loading' | 'authed' | 'guest' | 'error';
type Ctx = { user: User | null; status: Status; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const refresh = useCallback(async () => {
    try {
      const u = await auth.getMe();
      setUser(u); setStatus(u ? 'authed' : 'guest');
      // 결과 저장 스코프를 현재 사용자로 동기화(C: 교차사용자 격리). 비로그인=null→익명 스코프.
      setUserScope(u?.id ?? null);
    } catch (err) {
      // getMe 예외 = 401 만료가 아니라 서버/네트워크/DTO 오류(어댑터가 401은 null로 변환).
      // 로그아웃이 아니므로 'guest'(→/login)로 강등하지 않고 'error'로 둔다(일시 장애에
      // 사용자를 로그아웃시키지 않음). 단, 이전 사용자 스코프가 남지 않게 즉시 해제(격리).
      console.error('[auth] getMe 실패 — 일시 오류로 처리, 결과 스코프 해제:', err);
      setUser(null); setStatus('error'); setUserScope(null);
    }
  }, []);
  // 로그아웃은 refresh 결과와 무관하게 스코프를 먼저 해제(즉시 격리).
  const logout = useCallback(async () => {
    setUserScope(null);
    await auth.logout();
    await refresh();
  }, [refresh]);
  useEffect(() => { void refresh(); }, [refresh]);
  return <AuthCtx.Provider value={{ user, status, refresh, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
