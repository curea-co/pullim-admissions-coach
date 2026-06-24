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
