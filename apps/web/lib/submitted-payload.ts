'use client';

/**
 * 제출 payload를 sessionStorage에 임시 저장.
 * processing 페이지가 /api/analyze에 POST할 때 꺼내 쓴다.
 * 민감 데이터(생기부 text)를 포함하므로 sessionStorage에만 저장하고 localStorage는 사용하지 않는다.
 */

const STORAGE_KEY = 'pullim:submitted-payload';

export function saveSubmittedPayload(payload: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage 비가용(프라이빗 모드 등) — 무시.
  }
}

export function loadSubmittedPayload(): unknown | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSubmittedPayload(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
