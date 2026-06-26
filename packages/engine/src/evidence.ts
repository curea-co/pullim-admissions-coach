import type { PrescribedAction } from '@pullim/shared';

/** 모든 처방이 비어있지 않은 생기부 인용을 갖는지 보증(루프 ④ 증거인용 100%). */
export function assertCited(actions: PrescribedAction[]): true {
  for (const a of actions) {
    if (!a.evidence || a.evidence.quote.trim().length === 0) {
      throw new Error(`증거인용 누락: ${a.recordArea} / ${a.text}`);
    }
  }
  return true;
}

/** §6.3 톤: 단정형 합격 보장 금지. 근거+불확실성 고지문. */
export function buildUncertaintyNote(): string {
  // NOTE: 이 문구는 세 가지 불변식을 동시에 만족해야 한다.
  //  (a) evidence.test.ts: /합격(을|이)\s*보장|반드시 합격/ 에 매치되지 않을 것
  //  (b) golden.test.ts:   /합격을 보장|반드시 합격/ 에 매치되지 않을 것
  //  (c) rubric.test.ts:   '보장하지 않습니다' 부분문자열을 포함할 것
  // 따라서 "합격" 직후에 "을/이 보장"이 오지 않게 하면서( "합격 여부를" 사용 ) "보장하지 않습니다"를 유지한다.
  return '이 진단·처방은 업로드된 생기부 근거에 기반한 해석이며, 합격 여부를 보장하지 않습니다. 최종 평가 기준은 대학별 시행계획을 직접 확인하세요.';
}
