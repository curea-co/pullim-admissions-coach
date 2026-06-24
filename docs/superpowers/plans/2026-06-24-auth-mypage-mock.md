# 인증 + 마이페이지 (mock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 입시 코치에 가입·로그인·마이페이지를 mock 어댑터로 기능 완성하고, 나중에 한 줄 교체로 pullim-api에 연결할 수 있게 만든다.

**Architecture:** `AuthAdapter` 인터페이스 + `MockAuthAdapter`(localStorage). `AuthProvider`가 세션을 하이드레이트하고, 클라이언트 가드가 보호 라우트를 막는다. 데이터는 mock이되 인터페이스는 pullim-api `/me`·signup DTO에 맞춘다.

**Tech Stack:** Next 14 App Router, React 18, Tailwind v4(PUDS), vitest+jsdom(신규), localStorage.

## Global Constraints
- 기반 브랜치: `feat/puds-adoption`.
- **교체 지점은 `lib/auth/index.ts` 한 곳** — 직원이 여기 export만 pullim-api 어댑터로 바꾼다.
- 보호 라우트: `/submit /consent /processing /result /mypage` → 미로그인 시 `/login?next=`. 공개: `/ /login /signup`.
- mock 보안: **비밀번호 평문 저장 금지** — 세션/유저 레코드만 보관(비번은 가입 시 검증만, 저장 안 함).
- §6 카피 불변(정답/대본/합격답변 금지).
- 미성년 = 만 19세 미만(생년월일 기준). 동의 상태 `'none'|'pending'|'approved'`.
- PUDS 토큰 사용(brand/ink 유틸, `cn`). 컴포넌트는 기존 패턴(`components/*`).

---

### Task 1: vitest 토대 + AuthAdapter 타입

**Files:**
- Modify: `apps/web/package.json` (devDeps + test script)
- Create: `apps/web/vitest.config.ts`, `apps/web/lib/auth/types.ts`, `apps/web/lib/auth/types.test.ts`

- [ ] **Step 1: vitest 의존성·스크립트**

`apps/web/package.json` devDependencies에 추가: `"vitest": "^2.1.0"`, `"jsdom": "^25.0.0"`. scripts에 `"test": "vitest run"` 추가. 그리고 `pnpm install`.

- [ ] **Step 2: vitest.config.ts**

Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'jsdom', globals: true, include: ['lib/**/*.test.ts'] },
});
```

- [ ] **Step 3: 타입 정의**

Create `apps/web/lib/auth/types.ts`:
```ts
export type AgeBand = 'under14' | 'over14' | 'unknown';
export type GuardianConsent = 'none' | 'pending' | 'approved';

export type User = {
  id: string;
  email: string;
  displayName: string;
  ageBand: AgeBand;
  isMinor: boolean;
  guardianConsent: GuardianConsent;
  package: string; // entitlements.package
  tier: string;    // entitlements.tier
};

export type DiagnosisSummary = {
  id: string;
  createdAt: string;   // ISO
  track: string;       // 공학계열 등
  summary: string;     // 한 줄 요약
};

export type SignupInput = {
  email: string;
  password: string;
  displayName: string;
  birthDate: string; // YYYY-MM-DD
};

export type GuardianInput = {
  guardianName: string;
  relation: string;  // 부 / 모 / 기타
  phone: string;
};

export type SignupResult = {
  user: User;
  needsEmailVerify: boolean;
  needsGuardianConsent: boolean;
};

export interface AuthAdapter {
  getMe(): Promise<User | null>;
  signup(input: SignupInput): Promise<SignupResult>;
  verifyEmail(code: string): Promise<void>;
  submitGuardianConsent(input: GuardianInput): Promise<void>;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
  listDiagnoses(): Promise<DiagnosisSummary[]>;
}

// 만 나이 계산 — 미성년(만 19세 미만) 판정
export function isMinorByBirth(birthDate: string, today = new Date()): boolean {
  const b = new Date(birthDate);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age < 19;
}
```

- [ ] **Step 4: 타입/유틸 테스트**

Create `apps/web/lib/auth/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isMinorByBirth } from './types';
describe('isMinorByBirth', () => {
  const today = new Date('2026-06-24');
  it('만 18세는 미성년', () => expect(isMinorByBirth('2008-01-01', today)).toBe(true));
  it('만 19세는 성인', () => expect(isMinorByBirth('2007-01-01', today)).toBe(false));
  it('생일 안 지난 만 19→18 경계', () => expect(isMinorByBirth('2007-12-31', today)).toBe(true));
});
```

- [ ] **Step 5: 실행 + 커밋**

Run: `pnpm --filter @pullim/web test`  Expected: 3 passed.
```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/lib/auth pnpm-lock.yaml
git commit -m "feat(web): vitest 토대 + AuthAdapter 타입(인증 mock)"
```

---

### Task 2: MockAuthAdapter + 교체 지점

**Files:**
- Create: `apps/web/lib/auth/mock-adapter.ts`, `apps/web/lib/auth/mock-adapter.test.ts`, `apps/web/lib/auth/index.ts`

**Interfaces:**
- Consumes: `AuthAdapter`, `User`, `SignupInput`, `GuardianInput`, `DiagnosisSummary`, `isMinorByBirth` (Task 1)
- Produces: `mockAuthAdapter: AuthAdapter`; `auth: AuthAdapter` (from index.ts)

- [ ] **Step 1: 테스트 먼저**

Create `apps/web/lib/auth/mock-adapter.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mockAuthAdapter as a } from './mock-adapter';
beforeEach(() => localStorage.clear());

describe('MockAuthAdapter', () => {
  const adult = { email: 'a@b.com', password: 'pw123456', displayName: '성인', birthDate: '2000-01-01' };
  const minor = { ...adult, email: 'm@b.com', birthDate: '2010-01-01' };

  it('성인 가입 → 세션 + 인증필요, 보호자 불필요', async () => {
    const r = await a.signup(adult);
    expect(r.needsEmailVerify).toBe(true);
    expect(r.needsGuardianConsent).toBe(false);
    expect((await a.getMe())?.email).toBe('a@b.com');
  });

  it('미성년 가입 → 보호자 동의 필요(pending)', async () => {
    const r = await a.signup(minor);
    expect(r.needsGuardianConsent).toBe(true);
    expect((await a.getMe())?.guardianConsent).toBe('pending');
    await a.submitGuardianConsent({ guardianName: '학부모', relation: '모', phone: '01000000000' });
    expect((await a.getMe())?.guardianConsent).toBe('approved');
  });

  it('중복 이메일 가입 거부', async () => {
    await a.signup(adult);
    await expect(a.signup(adult)).rejects.toThrow();
  });

  it('login/logout', async () => {
    await a.signup(adult); await a.logout();
    expect(await a.getMe()).toBeNull();
    expect((await a.login('a@b.com', 'pw123456')).email).toBe('a@b.com');
    await expect(a.login('a@b.com', 'wrong')).rejects.toThrow();
  });

  it('진단 이력 mock 시드', async () => {
    await a.signup(adult);
    expect((await a.listDiagnoses()).length).toBeGreaterThanOrEqual(2);
  });

  it('회원탈퇴 → 세션·레코드 제거', async () => {
    await a.signup(adult); await a.deleteAccount();
    expect(await a.getMe()).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run `pnpm --filter @pullim/web test` → FAIL(모듈 없음).

- [ ] **Step 3: 구현**

Create `apps/web/lib/auth/mock-adapter.ts`:
```ts
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
```

Create `apps/web/lib/auth/index.ts`:
```ts
// 교체 지점 — 직원이 나중에 PullimApiAuthAdapter로 바꾸면 끝.
import { mockAuthAdapter } from './mock-adapter';
import type { AuthAdapter } from './types';
export const auth: AuthAdapter = mockAuthAdapter;
export * from './types';
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run `pnpm --filter @pullim/web test` → all pass.
```bash
git add apps/web/lib/auth
git commit -m "feat(web): MockAuthAdapter(localStorage) + 교체 지점 lib/auth/index"
```

---

### Task 3: AuthProvider + layout 연결

**Files:**
- Create: `apps/web/components/auth/auth-provider.tsx`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: `auth` (Task 2), `User`
- Produces: `useAuth(): { user; status: 'loading'|'authed'|'guest'; refresh; logout }`, `<AuthProvider>`

- [ ] **Step 1: AuthProvider**

Create `apps/web/components/auth/auth-provider.tsx`:
```tsx
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
```

- [ ] **Step 2: layout 래핑**

`apps/web/app/layout.tsx`의 `<body>` 내부를 `AuthProvider`로 감싼다:
```tsx
import { AuthProvider } from '@/components/auth/auth-provider';
// ...
<body>
  <AuthProvider>
    <DemoBanner />
    <AppShell>{children}</AppShell>
  </AuthProvider>
</body>
```

- [ ] **Step 3: 빌드 + 커밋** — `pnpm --filter @pullim/web build` 통과.
```bash
git add apps/web/components/auth/auth-provider.tsx apps/web/app/layout.tsx
git commit -m "feat(web): AuthProvider + layout 연결"
```

---

### Task 4: 상단바 user menu + 랜딩 CTA 게이팅

**Files:**
- Create: `apps/web/components/auth/user-menu.tsx`, `apps/web/components/auth/start-cta.tsx`
- Modify: `apps/web/components/app-shell.tsx`, `apps/web/app/page.tsx`

**Interfaces:** Consumes `useAuth` (Task 3). Produces `<UserMenu/>`, `<StartCta>`.

- [ ] **Step 1: UserMenu** — `components/auth/user-menu.tsx`('use client'): `useAuth()`로 분기. authed면 `displayName` + `/mypage` 링크 + 로그아웃 버튼, guest면 `로그인`(/login)·`가입`(/signup) 링크. PUDS 토큰(text-ink/brand, rounded-xl) 사용. status==='loading'이면 작은 스켈레톤.

- [ ] **Step 2: AppShell 연결** — `app-shell.tsx`의 `<DashboardShell ... actions={<UserMenu />}>`로 actions 슬롯에 주입(이미 DashboardShell에 actions 렌더 존재).

- [ ] **Step 3: StartCta** — `components/auth/start-cta.tsx`('use client'): `useAuth`로 href 결정(authed→`/submit`, guest→`/signup`). props `{ children, className }`. `app/page.tsx`의 "생기부 업로드 시작" CTA와 "학생이에요" 카드의 `/submit` 링크를 `<StartCta>`로 교체(학부모 카드는 `/parent` 유지).

- [ ] **Step 4: 빌드 + 수동 + 커밋** — 빌드 통과, 홈에서 비로그인 시 상단바 로그인/가입 노출 확인.
```bash
git add apps/web/components/auth apps/web/app/page.tsx apps/web/components/app-shell.tsx
git commit -m "feat(web): 상단바 user menu + 랜딩 CTA 가입 게이팅"
```

---

### Task 5: RequireAuth 가드 + 보호 라우트

**Files:**
- Create: `apps/web/components/auth/require-auth.tsx`
- Modify: `apps/web/app/submit/page.tsx`, `consent/page.tsx`, `processing/page.tsx`, `result/page.tsx`

**Interfaces:** Consumes `useAuth`. Produces `<RequireAuth>`.

- [ ] **Step 1: RequireAuth** — `components/auth/require-auth.tsx`('use client'):
```tsx
'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter(); const pathname = usePathname();
  useEffect(() => {
    if (status === 'guest') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);
  if (status !== 'authed') {
    return <div className="px-6 py-10 text-sm text-ink-500">확인 중…</div>;
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: 보호 페이지 래핑** — submit/consent/processing/result 4개 페이지의 최상위 반환 JSX를 `<RequireAuth>…</RequireAuth>`로 감싼다(각 페이지는 이미 'use client'). 기존 `<>...</>` 또는 `<main>` 바깥을 RequireAuth로.

- [ ] **Step 3: 빌드 + 수동 + 커밋** — 비로그인으로 `/submit` 접근 시 `/login?next=/submit` 리다이렉트 확인.
```bash
git add apps/web/components/auth/require-auth.tsx apps/web/app/{submit,consent,processing,result}/page.tsx
git commit -m "feat(web): RequireAuth 클라 가드 + 보호 라우트 적용"
```

---

### Task 6: /login 페이지

**Files:** Create `apps/web/app/login/page.tsx`

- [ ] **Step 1: 로그인 폼**('use client') — 이메일·비밀번호 입력, `auth.login` 호출, 성공 시 `refresh()` 후 `searchParams.next ?? '/mypage'`로 router.push. 실패 시 인라인 에러. "계정이 없으신가요? 가입" → `/signup`. PUDS 카드 스타일, 좌측 정렬, `useAuth().refresh` 사용. 이미 authed면 next로 즉시 이동.

- [ ] **Step 2: 빌드 + 수동 + 커밋** — Task 2에서 만든 계정으로 로그인 → /mypage 이동 확인(마이페이지는 Task 8).
```bash
git add apps/web/app/login/page.tsx
git commit -m "feat(web): /login 페이지"
```

---

### Task 7: /signup 페이지 (다단계)

**Files:** Create `apps/web/app/signup/page.tsx`

- [ ] **Step 1: 다단계 가입**('use client') — 단계 상태 `'account'|'verify'|'guardian'|'done'`.
  - account: 이메일·비번(8자+)·이름·생년월일 → 검증 후 `auth.signup`. 결과의 `needsEmailVerify`면 verify, 아니면(데모는 항상 verify) 다음.
  - verify: 인증코드 입력(데모 안내 "데모: 아무 코드나 입력") → `auth.verifyEmail`. `needsGuardianConsent`면 guardian, 아니면 done.
  - guardian: 보호자 이름·관계·연락처 → `auth.submitGuardianConsent`(미성년 보호자 동의 1회). → done.
  - done: `refresh()` 후 `next ?? '/submit'`로 이동.
  - 각 단계 인라인 에러, StepIndicator 류 진행 표시(가입 내부용 간단 표시). §6 무관(인증 폼).

- [ ] **Step 2: 빌드 + 수동 + 커밋** — 성인/미성년 각각 가입 흐름 통과 확인(미성년은 보호자 단계 노출).
```bash
git add apps/web/app/signup/page.tsx
git commit -m "feat(web): /signup 다단계(계정→인증→미성년 보호자 동의)"
```

---

### Task 8: /mypage 페이지 (계정 + 진단 이력 mock)

**Files:** Create `apps/web/app/mypage/page.tsx`

- [ ] **Step 1: 마이페이지**('use client', `<RequireAuth>`로 감쌈) — `useAuth().user` + `auth.listDiagnoses()`:
  - **프로필 카드**: 이름·이메일·연령대(미성년 배지)·미성년 동의 상태(`approved`면 ✓, `pending`이면 안내).
  - **요금제 카드**: package·tier(예 home·free), "요금제 변경은 곧" 안내.
  - **진단 이력 카드 목록**(mock): 날짜·계열·요약 + "다시 보기"→`/result`. 비어있으면 EmptyState로 "아직 진단이 없어요 → 생기부 제출"(/submit).
  - **계정 관리**: 로그아웃(`logout()`→`/`), 회원탈퇴(확인 모달 → `auth.deleteAccount()`→`/`).
  - PUDS 카드/배지/버튼 스타일, page-header 패턴(제목 "마이페이지").

- [ ] **Step 2: 빌드 + 수동 + 커밋** — 로그인 상태에서 /mypage가 프로필·요금제·이력(2건)·로그아웃·탈퇴 표시. 미로그인 시 가드 리다이렉트.
```bash
git add apps/web/app/mypage/page.tsx
git commit -m "feat(web): /mypage(프로필·요금제·진단 이력 mock·로그아웃·탈퇴)"
```

---

## Self-Review
- **Spec coverage:** AuthAdapter+교체지점(T1·T2·spec§4) · 미성년 판정/동의(T1·T2·T7·§6) · provider/가드(T3·T5·§4) · 상단바·CTA 게이팅(T4·§5) · login/signup/mypage(T6·T7·T8·§5) · 진단 이력 mock(T2·T8·§5) · vitest(T1·T2·§8). ✓
- **Placeholder scan:** 페이지(T6·T7·T8)는 구조·동작·핵심 동작을 명시하고 코드 일부만 — 실행 시 PUDS 패턴으로 완성(JSX는 기존 submit/consent 페이지 스타일 따름). 로직 핵심(adapter/provider/guard)은 전체 코드 제공.
- **Type consistency:** `User.guardianConsent`/`isMinor`/`ageBand`, `AuthAdapter` 시그니처가 T1 정의와 T2~T8 사용 일치. 교체 지점 `lib/auth/index.ts`의 `auth` 단일 export.
- **교체 가이드:** spec §9 + index.ts 주석 — 직원 후속.
