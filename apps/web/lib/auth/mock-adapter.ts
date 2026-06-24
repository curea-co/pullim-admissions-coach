import type {
  AuthAdapter, User, SignupInput, GuardianInput, DiagnosisSummary, SignupResult,
} from './types';
import { isMinorByBirth } from './types';

const SESSION_KEY = 'puds-auth-session'; // 현재 로그인 user id
const USERS_KEY = 'puds-auth-users';     // id -> {user, password(검증용, 데모 한정)}

type Rec = { user: User; password: string };
const read = (): Record<string, Rec> => {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}'); } catch { return {}; }
};
const write = (m: Record<string, Rec>) => localStorage.setItem(USERS_KEY, JSON.stringify(m));
const sessionId = () => localStorage.getItem(SESSION_KEY);
const setSession = (id: string | null) =>
  id ? localStorage.setItem(SESSION_KEY, id) : localStorage.removeItem(SESSION_KEY);

function seedDiagnoses(): DiagnosisSummary[] {
  return [
    { id: 'dx_2', createdAt: '2026-06-20T09:00:00Z', track: '공학계열', summary: '진로역량 보완 — 활동 연결 근거 보강 권장' },
    { id: 'dx_1', createdAt: '2026-05-30T09:00:00Z', track: '공학계열', summary: '학업역량 강점 — 자료구조·알고리즘 기록 풍부' },
  ];
}

async function delay<T>(v: T): Promise<T> { return new Promise((r) => setTimeout(() => r(v), 150)); }

export const mockAuthAdapter: AuthAdapter = {
  async getMe() {
    const id = sessionId(); if (!id) return delay(null);
    return delay(read()[id]?.user ?? null);
  },
  async signup(input: SignupInput): Promise<SignupResult> {
    const users = read();
    if (Object.values(users).some((r) => r.user.email === input.email))
      throw new Error('이미 가입된 이메일입니다.');
    const minor = isMinorByBirth(input.birthDate);
    const id = `user_${Object.keys(users).length + 1}`;
    const user: User = {
      id, email: input.email, displayName: input.displayName,
      ageBand: minor ? 'under14' : 'over14', // 데모 단순화(실연동 시 서버 ageBand 사용)
      isMinor: minor, guardianConsent: minor ? 'pending' : 'none',
      package: 'home', tier: 'free',
    };
    users[id] = { user, password: input.password };
    write(users); setSession(id);
    return delay({ user, needsEmailVerify: true, needsGuardianConsent: minor });
  },
  async verifyEmail(_code: string) { return delay(undefined); }, // mock: 항상 성공
  async submitGuardianConsent(_input: GuardianInput) {
    const id = sessionId(); const users = read();
    if (id && users[id]) { users[id].user.guardianConsent = 'approved'; write(users); }
    return delay(undefined);
  },
  async login(email, password) {
    const users = read();
    const rec = Object.values(users).find((r) => r.user.email === email);
    if (!rec || rec.password !== password) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    setSession(rec.user.id); return delay(rec.user);
  },
  async logout() { setSession(null); return delay(undefined); },
  async deleteAccount() {
    const id = sessionId(); const users = read();
    if (id) { delete users[id]; write(users); } setSession(null); return delay(undefined);
  },
  async listDiagnoses() { return delay(seedDiagnoses()); },
};
