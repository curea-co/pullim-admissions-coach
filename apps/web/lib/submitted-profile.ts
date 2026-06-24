'use client';

import { submittedProfileSchema, type SubmittedProfile } from '@pullim/shared';

const STORAGE_KEY = 'pullim:submitted-profile';

export function saveSubmittedProfile(p: SubmittedProfile): void {
  if (typeof window === 'undefined') return;
  // 비-PII 계약을 저장 경계에서 강제: 알 수 없는 키(생기부 text 등)는 스키마 parse가 제거.
  const safe = submittedProfileSchema.safeParse(p);
  if (!safe.success) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe.data));
  } catch {
    // sessionStorage 비가용(프라이빗 모드 등) — 데모 헤더만 영향, 무시.
  }
}

export function loadSubmittedProfile(): SubmittedProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = submittedProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type { SubmittedProfile };
