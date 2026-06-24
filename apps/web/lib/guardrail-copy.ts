/**
 * 정의 v0.3 §6 가드 카피 SSOT (단일 출처).
 * 컴포넌트(guardrail-label.tsx)와 테스트 모두 이 파일을 직접 import한다.
 *
 * IMPORTANT: 이 파일의 문자열을 변경하면 guardrail-copy.test.ts 스냅샷 테스트가
 * 실패하여 §6 가드 카피 변경이 즉시 감지된다. 변경 시 정의 §6을 재확인할 것.
 */

export type GuardrailVariant = 'interview' | 'diagnosis' | 'general';

export const GUARDRAIL_COPY: Record<GuardrailVariant, { title: string; body: string }> = {
  general: {
    title: 'AI는 방향과 근거만 제공합니다',
    body:
      '정답·대본을 주지 않습니다. 생기부 기재는 학교 교사 영역이며, 본 서비스는 학생 본인이 앞으로 할 활동만 제안합니다.',
  },
  interview: {
    title: '면접 *준비* 팩 — 대본이 아닙니다',
    body:
      '답변 방향·근거·꼬리질문만 제공합니다. 학생이 자신의 언어로 답할 수 있도록 설계되었습니다.',
  },
  diagnosis: {
    title: '생기부 *진단* 가이드 — 개입이 아닙니다',
    body:
      '교사 기재 영역(세특·행특 등) 문구는 제공하지 않습니다. 학생 본인이 앞으로 할 활동만 제안합니다.',
  },
};
