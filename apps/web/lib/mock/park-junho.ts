// 박준호 페르소나 mock 데이터 — Phase A 시각 셸 전용.
// 출처: docs/003_Admissions_Coach_personas_v.2.md (v0.1.2), 정의 v0.3 §4.
// 실 사용자 데이터 아님. Phase D에서 실제 AI 응답으로 대체.

import type { TargetTrack, SchoolType } from '@pullim/shared';

export type InterviewQuestion = {
  question: string;
  direction: string;
  evidence: string[];
  followUp: string;
};

export type DiagnosisCriterion = {
  name: '학업역량' | '진로역량' | '공동체역량' | '인성' | '기타';
  score: '강함' | '보통' | '약함';
  observation: string;
  nextSteps: string;
};

export type ImprovementSuggestion = {
  title: string;
  description: string;
};

export const parkJunho = {
  identity: {
    displayLabel: '예시 학생 (데모)',
    grade: 3,
    semester: 2,
    schoolType: 'general' as SchoolType,
  },
  profile: {
    targetTrack: 'science_engineering' as TargetTrack,
    targetUniversities: [
      { name: '서울대학교', department: '컴퓨터공학부' },
      { name: '연세대학교', department: '컴퓨터과학공학부' },
      { name: '한양대학교', department: '컴퓨터소프트웨어학부' },
    ],
    weakAreas: '진로 활동 일관성, 면접 답변 준비가 부족하다고 느낌',
  },
  interviewPack: {
    questions: [
      {
        question:
          '학교생활 중 가장 의미 있게 참여한 활동과 그 활동이 본인에게 어떤 영향을 주었는지 말해주세요.',
        direction:
          '코딩 동아리 활동과 진로 탐색을 잇는 흐름으로 답변. 결과보다 *과정에서 배운 것*에 무게.',
        evidence: [
          '창체-동아리(코딩 동아리, 2년 연속 활동)',
          '진로활동-진로탐색 보고서(소프트웨어 엔지니어)',
          '세특-정보 과목(자료구조 발표)',
        ],
        followUp: '그 활동에서 가장 어려웠던 점은 무엇이었고 어떻게 해결했나요?',
      },
      {
        question:
          '본인이 지원한 학부의 적성과 본인의 활동이 어떻게 연결된다고 생각하나요?',
        direction:
          '학업역량(정보·수학)과 진로 시도(동아리 산출물)를 두 축으로 두고, *왜 이 학부가 본인의 시도를 더 깊게 할 수 있는 장소인지* 본인 언어로 설명.',
        evidence: [
          '교과 성취도(정보·수학·과학)',
          '동아리 산출물(개인 프로젝트 정리)',
          '독서활동(컴퓨터과학 기초 도서)',
        ],
        followUp: '입학 후 가장 먼저 해보고 싶은 활동·연구가 있나요?',
      },
      {
        question: '팀 안에서 의견이 갈렸을 때 어떻게 행동했는지 사례를 들어주세요.',
        direction:
          '공동체역량 — *합의 과정*과 *본인의 역할 변화*를 시간 순으로 짧게. 누가 옳고 그른지가 아니라 *어떻게 같이 나아갔는지*.',
        evidence: ['수행평가 팀 과제', '동아리 발표 준비'],
        followUp: '그 경험을 한 줄로 요약한다면 본인에게 어떤 의미였나요?',
      },
    ] satisfies InterviewQuestion[],
  },
  diagnosisGuide: {
    criteria: [
      {
        name: '학업역량',
        score: '강함',
        observation:
          '정보·수학 과목 성취도 우수. 세특에 자료구조 발표·알고리즘 학습 기록이 풍부.',
        nextSteps:
          '심화 학습 경험을 진로활동·독서 기록으로 *연결*해 일관성을 만들면 평가 인상이 더 또렷해진다.',
      },
      {
        name: '진로역량',
        score: '보통',
        observation:
          '진로 방향(소프트웨어 엔지니어)은 분명하나, *본인이 직접 시도한 프로젝트 사례*의 기록이 다소 적음.',
        nextSteps:
          '동아리에서 만든 산출물·코드를 본인이 진로활동·자율 정리란에 정리해 *시도와 학습*을 보여줄 것.',
      },
      {
        name: '공동체역량',
        score: '보통',
        observation:
          '동아리·수행평가에서 협력 경험이 있으나 *역할·갈등 해결 과정*에 대한 본인 정리가 부족.',
        nextSteps:
          '팀 작업에서 본인이 맡은 역할과 *어떤 결정에 어떻게 기여했는지*를 한두 줄로 본인이 직접 정리.',
      },
      {
        name: '인성',
        score: '강함',
        observation:
          '담임·교과 교사 평가에서 성실·책임감 항목 일관됨. 별도 보완 권고 없음.',
        nextSteps: '현재 흐름 유지.',
      },
      {
        name: '기타',
        score: '보통',
        observation: '독서 활동 권수는 적정. *본인 의견* 기록이 짧은 편.',
        nextSteps:
          '관심 분야 도서 1~2권을 추가하면서 *왜 그 책을 골랐고 무엇이 남았는지* 짧게 본인 의견을 더할 것.',
      },
    ] satisfies DiagnosisCriterion[],
  },
  improvements: {
    keywords: ['알고리즘', '자료구조', '동아리', '발표', '협력', '진로'],
    fitDelta:
      '공학계열 기준 — 학업역량은 강세, 진로역량의 *실제 시도* 항목이 다소 약함. 인성·공동체는 안정권.',
    suggestions: [
      {
        title: '본인 주도 프로젝트 정리',
        description:
          '동아리에서 만든 산출물·코드를 학생 본인이 정리하여 *시도와 학습 과정*을 드러낼 것.',
      },
      {
        title: '관심 분야 독서 1~2권 추가',
        description:
          '컴퓨터과학 기초·진로 관련 도서를 골라 본인 의견과 함께 짧게 기록.',
      },
      {
        title: '협력 경험 보강',
        description:
          '동아리·수행평가에서의 팀 작업에서 본인 역할·기여를 한두 줄로 정리.',
      },
    ] satisfies ImprovementSuggestion[],
  },
  parentReport: {
    weekOf: '2026-06-01',
    progress: 'AI 1차 결과 도착 · 학생 검토 진행 중',
    summaryHighlights: [
      '면접 준비 팩과 생기부 진단이 24시간 안에 도착했습니다.',
      '학생이 학생부 종합 전형 평가 기준에서 자신의 강·약점을 확인하는 단계입니다.',
      '강세 영역: 학업역량·인성. 보완 필요 영역: 진로역량·공동체역량.',
    ],
    nextWeekPlan:
      '면접 예상 질문 10종 중 어려워한 3개에 대해 본인 답변을 정리할 예정입니다.',
  },
} as const;
