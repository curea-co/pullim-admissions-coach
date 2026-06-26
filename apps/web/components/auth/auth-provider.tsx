'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, type User } from '@/lib/auth';
import { setUserScope } from '@/lib/result';

type Status = 'loading' | 'authed' | 'guest';
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
      // getMe 실패(서버/네트워크/DTO) 시에도 **이전 사용자 override가 남지 않게** 스코프를
      // 즉시 해제한다 — 안 그러면 로그아웃/오류 후에도 결과 저장소가 이전 사용자 스코프를
      // 계속 읽고 쓰는 교차사용자 노출이 생긴다. (UX상 에러/재시도 표시는 연동 시 폴리시.)
      console.error('[auth] getMe 실패 — 게스트로 강등하고 결과 스코프 해제:', err);
      setUser(null); setStatus('guest'); setUserScope(null);
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
