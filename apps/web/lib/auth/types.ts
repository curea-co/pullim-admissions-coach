export type AgeBand = 'under14' | 'over14' | 'unknown';
// 'unknown' = 권위 소스 미연결(예: auth /me 는 입시 만19 보호자 동의를 모름 — admissions 도메인).
// UI 는 'unknown' 을 '대기'(amber)로 오표시하지 말고 중립(확인 필요)으로 다뤄야 한다.
export type GuardianConsent = 'none' | 'pending' | 'approved' | 'unknown';

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

// 만 14세 경계로 ageBand 산출(개인정보 동의 경계) — isMinorByBirth(만19)와 별개
export function ageBandFromBirth(birthDate: string, today = new Date()): AgeBand {
  const b = new Date(birthDate);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age < 14 ? 'under14' : 'over14';
}
