'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, type User } from '@/lib/auth';

type Status = 'loading' | 'authed' | 'guest';
type Ctx = { user: User | null; status: Status; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const refresh = useCallback(async () => {
    const u = await auth.getMe();
    setUser(u); setStatus(u ? 'authed' : 'guest');
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
