// 박준호 페르소나 mock 데이터 — Phase A 시각 셸 전용.
// 출처: docs/003_Admissions_Coach_personas_v.2.md (v0.1.2), 정의 v0.3 §4.
// 실 사용자 데이터 아님. Phase D에서 실제 AI 응답으로 대체.

import type { TargetTrack, SchoolType, DiagnosisGuide } from '@pullim/shared';

export type InterviewQuestion = {
  question: string;
  direction: string;
  evidence: string[];
  followUp: string;
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
        competency: 'academic',
        summary: '교과 성취와 탐구 기록이 탄탄합니다.',
        highlights: [
          {
            item: '학업성취도',
            flag: 'strength',
            evidence: ['세특-정보(자료구조 발표)', '세특-수학(미적분 응용)'],
            note: '정보·수학 성취도가 우수하고 세특 기록이 구체적입니다.',
          },
          {
            item: '탐구력',
            flag: 'strength',
            evidence: ['세특-정보(자료구조·알고리즘 학습)'],
            note: '학습 결과를 발표로 확장한 시도가 보입니다.',
          },
          {
            item: '학업태도',
            flag: 'gap',
            evidence: ['교과-정보'],
            note: '자기주도 학습 과정의 기록이 더 드러나면 인상이 또렷해집니다.',
          },
        ],
        nextSteps: '심화 학습 경험을 진로 활동·정리로 본인이 연결해 일관성을 만들 것.',
      },
      {
        competency: 'career',
        summary: '진로 방향은 분명하나 본인이 직접 시도한 사례 기록이 더 필요합니다.',
        highlights: [
          {
            item: '전공(계열) 관련 교과 이수 노력',
            flag: 'strength',
            evidence: ['교과-정보', '교과-수학'],
            note: '전공 관련 교과를 충실히 이수했습니다.',
          },
          {
            item: '진로 탐색 활동과 경험',
            flag: 'gap',
            evidence: ['진로활동-진로탐색 보고서(소프트웨어 엔지니어)'],
            note: '본인 주도 프로젝트·산출물 기록이 다소 적습니다.',
          },
        ],
        nextSteps: '동아리에서 만든 산출물·코드를 본인이 진로활동·자율 정리란에 정리해 시도와 학습을 보여줄 것.',
      },
      {
        competency: 'community',
        summary: '협력 경험과 성실성은 안정적이나 본인 역할 정리가 더 필요합니다.',
        highlights: [
          {
            item: '성실성과 규칙준수',
            flag: 'strength',
            evidence: ['행특(성실·책임감 평가 일관)'],
            note: '담임·교과 교사 평가가 일관됩니다.',
          },
          {
            item: '협업과 소통능력',
            flag: 'gap',
            evidence: ['수행평가 팀 과제', '창체-동아리(발표 준비)'],
            note: '역할·갈등 해결 과정에 대한 본인 정리가 부족합니다.',
          },
        ],
        nextSteps: '팀 작업에서 본인이 맡은 역할과 어떤 결정에 어떻게 기여했는지를 한두 줄로 본인이 직접 정리할 것.',
      },
    ],
  } satisfies DiagnosisGuide,
  improvements: {
    keywords: ['알고리즘', '자료구조', '동아리', '발표', '협력', '진로'],
    fitDelta:
      '공학계열 기준 — 학업역량은 강세, 진로역량의 *실제 시도* 항목이 다소 약함. 공동체역량(성실성·협업)은 안정권.',
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
      '강세 영역: 학업역량·공동체역량. 보완 필요 영역: 진로역량.',
    ],
    nextWeekPlan:
      '면접 예상 질문 10종 중 어려워한 3개에 대해 본인 답변을 정리할 예정입니다.',
  },
} as const;
