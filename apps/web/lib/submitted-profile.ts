'use client';

import { submittedProfileSchema, type SubmittedProfile } from '@pullim/shared';

const STORAGE_KEY = 'pullim:submitted-profile';

export function saveSubmittedProfile(p: SubmittedProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
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
