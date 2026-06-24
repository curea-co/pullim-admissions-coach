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
