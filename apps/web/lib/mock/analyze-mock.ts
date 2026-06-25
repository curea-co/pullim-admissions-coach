/**
 * analyze-mock.ts
 *
 * ANTHROPIC_API_KEY 가 없을 때 /api/analyze 라우트가 반환할 데모 AnalyzeResult.
 * parkJunho 페르소나 데이터를 AnalyzeResult 형태(cohort, diagnosis, rubric, interview)로 변환한다.
 * 실 사용자 데이터 아님 — demo 폴백 전용.
 */

import type { AnalyzeResult } from '@/lib/analyze';
import type { StudentProfile } from '@pullim/shared';
import { cohortFromGrade } from '@pullim/shared';

export function mockAnalyzeResult(_payload: StudentProfile): AnalyzeResult {
  // cohort: payload의 학년을 사용하거나, 데모 고정값(고3)
  const grade = _payload.currentStanding.grade;
  const cohort = cohortFromGrade(grade);

  // diagnosis: parkJunho.diagnosisGuide → Diagnosis 형태로 변환
  const diagnosis: AnalyzeResult['diagnosis'] = {
    criteria: [
      {
        key: 'ACADEMIC',
        mapping: '교과 성취도 · 탐구 기록 · 학업태도 — 세특 우선 평가',
        strength: '정보·수학 성취도가 우수하고 세특 기록이 구체적입니다. 학습 결과를 발표로 확장한 시도가 보입니다.',
        weakness: '자기주도 학습 과정의 기록이 더 드러나면 인상이 또렷해집니다.',
        evidence: [
          { quote: '자료구조 발표 - 알고리즘 적용 사례 분석', section: '세특-정보' },
          { quote: '미적분 응용 심화 탐구', section: '세특-수학' },
        ],
      },
      {
        key: 'CAREER',
        mapping: '전공 관련 교과 이수 · 진로 탐색 활동 · 본인 주도 시도',
        strength: '전공 관련 교과(정보·수학)를 충실히 이수했습니다.',
        weakness: '본인 주도 프로젝트·산출물 기록이 다소 적습니다.',
        evidence: [
          { quote: '소프트웨어 엔지니어 진로탐색 보고서 작성', section: '진로활동-진로탐색 보고서' },
          { quote: '코딩 동아리 2년 연속 활동', section: '창체-동아리' },
        ],
      },
      {
        key: 'COMMUNITY',
        mapping: '성실성·규칙준수 · 협업·소통능력 · 나눔·배려',
        strength: '담임·교과 교사 평가가 일관됩니다. 성실성·책임감이 전 학기 고르게 드러납니다.',
        weakness: '역할·갈등 해결 과정에 대한 본인 정리가 부족합니다.',
        evidence: [
          { quote: '성실·책임감 평가 일관', section: '행특' },
          { quote: '팀 과제 참여', section: '수행평가 팀 과제' },
        ],
      },
    ],
  };

  // rubric: parkJunho.improvements.suggestions → Rubric items
  const rubric: AnalyzeResult['rubric'] = {
    cohort,
    items: [
      {
        recordArea: 'CREATIVE_REGULAR',
        competency: 'CAREER',
        text: '동아리 산출물·코드를 학생 본인이 정리하여 시도와 학습 과정을 드러낼 것.',
        rationale: '진로역량의 실제 시도가 세특·진로활동 기록에 명시적으로 드러나면 평가 인상이 선명해집니다.',
        evidence: { quote: '코딩 동아리 2년 연속 활동', section: '창체-동아리' },
      },
      {
        recordArea: 'SETUK',
        competency: 'ACADEMIC',
        text: '정보·수학 수업에서의 심화 관심을 본인이 탐구·발표로 이어가 세특에 드러날 시도를 만들 것.',
        rationale: '학업역량은 이미 강세입니다. 탐구를 세특으로 명시적으로 연결하면 평가자 인상이 강화됩니다.',
        evidence: { quote: '자료구조 발표 - 알고리즘 적용 사례 분석', section: '세특-정보' },
      },
      {
        recordArea: 'BEHAVIOR',
        competency: 'COMMUNITY',
        text: '동아리·수행평가에서의 팀 작업에서 본인 역할·기여를 한두 줄로 정리.',
        rationale: '공동체역량(성실성·협업)은 안정권이나, 역할 기술이 추가되면 설득력이 높아집니다.',
        evidence: { quote: '팀 과제 참여', section: '수행평가 팀 과제' },
      },
    ],
    uncertaintyNote:
      '본 처방은 제출된 생기부 기록 기반 참고 자료입니다. 실제 대입 결과를 보장하지 않습니다.',
    stripped: [],
  };

  // interview: parkJunho.interviewPack → InterviewPack 형태로 변환
  const interview: AnalyzeResult['interview'] = {
    questions: [
      {
        question:
          '학교생활 중 가장 의미 있게 참여한 활동과 그 활동이 본인에게 어떤 영향을 주었는지 말해주세요.',
        basis: {
          quote: '코딩 동아리 2년 연속 활동 — 자료구조 발표까지 이어진 탐구 흐름',
          section: '창체-동아리 / 세특-정보',
        },
        answerDirection:
          '코딩 동아리 활동과 진로 탐색을 잇는 흐름으로 답변. 결과보다 *과정에서 배운 것*에 무게.',
        followups: [
          '그 활동에서 가장 어려웠던 점은 무엇이었고 어떻게 해결했나요?',
        ],
      },
      {
        question:
          '본인이 지원한 학부의 적성과 본인의 활동이 어떻게 연결된다고 생각하나요?',
        basis: {
          quote: '정보·수학 교과 성취 + 동아리 산출물(개인 프로젝트 정리)',
          section: '교과 성취도 / 창체-동아리',
        },
        answerDirection:
          '학업역량(정보·수학)과 진로 시도(동아리 산출물)를 두 축으로 두고, *왜 이 학부가 본인의 시도를 더 깊게 할 수 있는 장소인지* 본인 언어로 설명.',
        followups: [
          '입학 후 가장 먼저 해보고 싶은 활동·연구가 있나요?',
        ],
      },
      {
        question: '팀 안에서 의견이 갈렸을 때 어떻게 행동했는지 사례를 들어주세요.',
        basis: {
          quote: '팀 과제 수행 및 동아리 발표 준비 협력',
          section: '수행평가 팀 과제 / 창체-동아리',
        },
        answerDirection:
          '공동체역량 — *합의 과정*과 *본인의 역할 변화*를 시간 순으로 짧게. 누가 옳고 그른지가 아니라 *어떻게 같이 나아갔는지*.',
        followups: [
          '그 경험을 한 줄로 요약한다면 본인에게 어떤 의미였나요?',
        ],
      },
    ],
  };

  return { cohort, diagnosis, rubric, interview };
}
