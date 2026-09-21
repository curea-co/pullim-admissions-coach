/**
 * 정의 v0.3 §6 가드 카피 SSOT (단일 출처).
 * 컴포넌트(guardrail-label.tsx)와 테스트 모두 이 파일을 직접 import한다.
 *
 * 2026-09-21 정정: 제목의 강조를 `*별표*` 로 적어 뒀는데 이 앱에는 마크다운 파서가 없다
 * (guardrail-label.tsx 가 `<p>{title}</p>` 로 평문 출력) — 화면에 별표가 그대로 보였다.
 * 하필 강조하려던 단어가 정의 §6.1 이 "설계→진단 / 대본→준비" 로 확정한 그 단어라, 의도만
 * 깨진 채 별표만 남아 있었다. 같은 앱이 이미 쓰는 곡선 따옴표 표기로 옮긴다
 * (hero-3d.tsx 의 `답변 “방향” · 정답 아님`, app/page.tsx 의 `“앞으로 할 활동”`).
 * 같은 패스에서 interview body 의 피동형 "설계되었습니다" 도 정리했다(docs/012 A7).
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
    title: '면접 “준비” 팩 — 대본이 아닙니다',
    body:
      '답변 방향·근거·꼬리질문만 제공합니다. 학생이 자기 언어로 답하도록 돕습니다.',
  },
  diagnosis: {
    title: '생기부 “진단” 가이드 — 개입이 아닙니다',
    body:
      '교사 기재 영역(세특·행특 등) 문구는 제공하지 않습니다. 학생 본인이 앞으로 할 활동만 제안합니다.',
  },
};
