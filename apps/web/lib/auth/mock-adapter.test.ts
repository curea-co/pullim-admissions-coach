import { describe, it, expect, beforeEach } from 'vitest';
import { mockAuthAdapter as a } from './mock-adapter';
beforeEach(() => localStorage.clear());

describe('MockAuthAdapter', () => {
  const adult = { email: 'a@b.com', password: 'pw123456', displayName: '성인', birthDate: '2000-01-01' };
  // 만14 경계로 가른다(2026-09-20 정정, 경위는 lib/consent-gate.ts).
  const under14 = { ...adult, email: 'u@b.com', birthDate: '2015-01-01' }; // 만 11
  const highSchooler = { ...adult, email: 'h@b.com', birthDate: '2010-01-01' }; // 만 16 — 고1

  it('성인 가입 → 세션 + 인증필요, 보호자 불필요', async () => {
    const r = await a.signup(adult);
    expect(r.needsEmailVerify).toBe(true);
    expect(r.needsGuardianConsent).toBe(false);
    expect((await a.getMe())?.email).toBe('a@b.com');
  });

  it('만14 미만 가입 → 보호자 동의 필요(pending)', async () => {
    const r = await a.signup(under14);
    expect(r.needsGuardianConsent).toBe(true);
    expect((await a.getMe())?.guardianConsent).toBe('pending');
    await a.submitGuardianConsent({ guardianName: '학부모', relation: '모', phone: '01000000000' });
    expect((await a.getMe())?.guardianConsent).toBe('approved');
  });

  it('고1(만 16) 가입 → 보호자 동의 불필요 — 민법상 미성년이지만 동의 축은 만14다', async () => {
    const r = await a.signup(highSchooler);
    expect(r.needsGuardianConsent).toBe(false);
    expect(r.user.isMinor).toBe(true); // 만19 사실값은 그대로 남는다(마이페이지 배지)
    expect(r.user.ageBand).toBe('over14');
    expect((await a.getMe())?.guardianConsent).toBe('none');
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
