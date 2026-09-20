'use client';

/**
 * 제출 payload를 sessionStorage에 임시 저장.
 * processing 페이지가 admissions 백엔드로 접수(submitAndDiagnose)할 때 꺼내 쓴다.
 * 민감 데이터(생기부 text)를 포함하므로 sessionStorage에만 저장하고 localStorage는 사용하지 않는다.
 */

const STORAGE_KEY = 'pullim:submitted-payload';

/**
 * 제출 payload를 저장하고 **쓰기 성공 여부**를 반환한다.
 * 호출자는 false면 다음 단계로 진행하지 말아야 한다(fail-closed): 저장이 조용히
 * 실패한 채 이전 제출 payload가 남아 있으면, 이후 단계가 다른 학생의 데이터를
 * 잘못 분석할 수 있다(정합성/프라이버시).
 */
export function saveSubmittedPayload(payload: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const serialized = JSON.stringify(payload);
    window.sessionStorage.setItem(STORAGE_KEY, serialized);
    // 쓰기 검증: 프라이빗 모드/쿼터 초과 등에서 setItem이 조용히 실패할 수 있으므로
    // 실제로 같은 값이 저장됐는지 읽어 확인한다.
    return window.sessionStorage.getItem(STORAGE_KEY) === serialized;
  } catch {
    // sessionStorage 비가용(프라이빗 모드 등) — 저장 실패로 보고.
    return false;
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

/**
 * 이번 제출 payload에 동의 화면에서 받은 *실제* consent를 덮어써 병합한다.
 * record 등 다른 필드는 유지하고 consent만 갱신 — 서버(admissions consents)가 올바른
 * 동의 상태로 적재하게 한다. 이전/타 학생 record는 호출부(handleProceed)가 존재 검증으로
 * 차단하며, 이 함수는 병합 규칙(record 보존 + consent 덮어쓰기)만 담당한다.
 */
export function mergeConsentIntoPayload(
  existing: unknown,
  consent: unknown
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object'
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, consent };
}

export function clearSubmittedPayload(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
