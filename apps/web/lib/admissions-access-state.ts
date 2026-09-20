import type { ApiError } from '@/lib/api';

/**
 * admissions 게이트 effect 의 **핵심 오류 분기**(Codex #59) — React 무관 순수 함수로 분리해 단위 테스트.
 * - 401/세션만료 + 재시도 잔여(retryCount<1) → `'retry'`(호출부: refresh + nonce++, 카운터 증가).
 * - 그 외(재시도 소진·5xx·네트워크) → `'error'`.
 * 세션 만료가 아닌 이유로 401이 지속돼도 재시도는 1회로 제한 → 무한 재검증 루프 방지.
 * 성공 분기(보유→'ok' / 미보유→'denied')는 호출부 매핑(자명).
 */
export function decideAccessOnError(err: ApiError | undefined, retryCount: number): 'retry' | 'error' {
  if ((err?.authExpired || err?.status === 401) && retryCount < 1) return 'retry';
  return 'error';
}
