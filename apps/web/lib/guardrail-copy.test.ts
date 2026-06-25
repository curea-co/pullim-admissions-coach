/**
 * §6 가드 카피 핀 테스트.
 *
 * GUARDRAIL_COPY의 문자열이 바뀌면 이 테스트가 즉시 실패하여
 * §6 가드 카피 무손상 원칙 위반을 감지한다.
 * 변경이 의도적이라면 스냅샷을 함께 업데이트하고 정의 §6을 재확인할 것.
 */

import { describe, it, expect } from 'vitest';
import { GUARDRAIL_COPY } from './guardrail-copy';

describe('§6 가드 카피 — SSOT 핀 테스트', () => {
  it('general variant 카피가 변경되지 않았다', () => {
    expect(GUARDRAIL_COPY.general).toMatchInlineSnapshot(`
      {
        "body": "정답·대본을 주지 않습니다. 생기부 기재는 학교 교사 영역이며, 본 서비스는 학생 본인이 앞으로 할 활동만 제안합니다.",
        "title": "AI는 방향과 근거만 제공합니다",
      }
    `);
  });

  it('interview variant 카피가 변경되지 않았다', () => {
    expect(GUARDRAIL_COPY.interview).toMatchInlineSnapshot(`
      {
        "body": "답변 방향·근거·꼬리질문만 제공합니다. 학생이 자신의 언어로 답할 수 있도록 설계되었습니다.",
        "title": "면접 *준비* 팩 — 대본이 아닙니다",
      }
    `);
  });

  it('diagnosis variant 카피가 변경되지 않았다 (§6.1 세특·행특 비개입 보증)', () => {
    expect(GUARDRAIL_COPY.diagnosis).toMatchInlineSnapshot(`
      {
        "body": "교사 기재 영역(세특·행특 등) 문구는 제공하지 않습니다. 학생 본인이 앞으로 할 활동만 제안합니다.",
        "title": "생기부 *진단* 가이드 — 개입이 아닙니다",
      }
    `);
  });

  it('§6.1 세특 비개입 보증 문구가 diagnosis body에 포함되어 있다', () => {
    expect(GUARDRAIL_COPY.diagnosis.body).toContain('세특·행특');
    expect(GUARDRAIL_COPY.diagnosis.body).toContain('문구는 제공하지 않습니다');
  });

  it('§6 general body에 정답·대본 미제공 문구가 포함되어 있다', () => {
    expect(GUARDRAIL_COPY.general.body).toContain('정답·대본을 주지 않습니다');
    expect(GUARDRAIL_COPY.general.body).toContain('학교 교사 영역');
  });
});
