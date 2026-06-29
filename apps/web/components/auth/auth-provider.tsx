'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, type User } from '@/lib/auth';
import { setUserScope } from '@/lib/result/scope';

type Status = 'loading' | 'authed' | 'guest';
type Ctx = { user: User | null; status: Status; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const refresh = useCallback(async () => {
    const u = await auth.getMe();
    setUser(u); setStatus(u ? 'authed' : 'guest');
    // 저장 격리 스코프를 실제 사용자 id 로 배선(로그아웃=null → 탭별 익명 스코프).
    // 공용 브라우저에서 다른 사용자에게 진단 이력·자기답변이 노출되지 않게 한다(scope.ts).
    setUserScope(u?.id ?? null);
  }, []);
  const logout = useCallback(async () => { await auth.logout(); await refresh(); }, [refresh]);
  useEffect(() => { void refresh(); }, [refresh]);
  return <AuthCtx.Provider value={{ user, status, refresh, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
