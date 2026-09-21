import { describe, it, expect, beforeEach } from 'vitest';
import { clearAnalyzeResult, toResultViewModel } from './result-view';
import type { AnalyzeResult } from './analyze';
import type { CohortResult } from '@pullim/shared';

// ── 최소 픽스처 ────────────────────────────────────────────────────────────

const cohort: CohortResult = { system: '2028_new', track: 'core', region: 'unknown', emphasizeSetuk: true };

const minimalResult: AnalyzeResult = {
  cohort,
  diagnosis: {
    keywords: [{ label: '검증 절차', count: 3 }, { label: '또래 멘토링', count: 2 }, { label: '자료 시각화', count: 2 }, { label: '알고리즘 구현', count: 1 }, { label: '학급 자치', count: 1 }],
    criteria: [
      {
        key: 'ACADEMIC',
        mapping: '학업 매핑',
        summary: '학업 매핑 총평입니다.',
        strengths: [{ title: '수학 세특 우수', detail: '수학 세특 우수 상세' }],
        gaps: [{ title: '탐구 기록 부족', detail: '탐구 기록 부족 상세' }],
        nextSteps: ['학업 매핑 다음 할 일'],
        evidence: [{ quote: '자료구조 발표', section: '세특-정보' }],
      },
      {
        key: 'CAREER',
        mapping: '진로 매핑',
        summary: '진로 매핑 총평입니다.',
        strengths: [{ title: '진로 방향 명확', detail: '진로 방향 명확 상세' }],
        gaps: [{ title: '시도 기록 미흡', detail: '시도 기록 미흡 상세' }],
        nextSteps: ['진로 매핑 다음 할 일'],
        evidence: [],
      },
      {
        key: 'COMMUNITY',
        mapping: '공동체 매핑',
        summary: '공동체 매핑 총평입니다.',
        strengths: [{ title: '성실성 우수', detail: '성실성 우수 상세' }],
        gaps: [{ title: '리더십 기록 부족', detail: '리더십 기록 부족 상세' }],
        nextSteps: ['공동체 매핑 다음 할 일'],
        evidence: [
          { quote: '팀 과제 기여', section: '수행평가' },
          { quote: '봉사 참여', section: '봉사활동' },
        ],
      },
    ],
  },
  rubric: {
    cohort,
    items: [
      {
        recordArea: 'SETUK',
        competency: 'ACADEMIC',
        text: '수학 심화 탐구를 세특에 드러낼 것',
        rationale: '학업역량 보강',
        estimatedMinutes: 60,
        linkedQuestions: ['Q1'],
        evidence: { quote: '자료구조 발표', section: '세특-정보' },
      },
    ],
    uncertaintyNote: '일부 불확실',
    stripped: [],
  },
};

const withInterviewResult: AnalyzeResult = {
  ...minimalResult,
  interview: {
    questions: [
      {
        question: '가장 의미 있는 활동은?',
        format: 'record_based',
        pressure: false,
        evidence: [{ quote: '코딩 동아리 산출물', section: '창체-동아리' }],
        answerDirection: '과정과 배움 중심으로 답할 것',
        followups: ['가장 어려웠던 점은?', '다음에 또 하겠냐?'],
      },
    ],
  },
};

// ── 레거시 세션 저장소 정리 ────────────────────────────────────────────────

describe('clearAnalyzeResult', () => {
  beforeEach(() => sessionStorage.clear());

  it('예전 배포가 남긴 결과·데모 플래그를 모두 비운다', () => {
    sessionStorage.setItem('pullim:analyze-result', JSON.stringify(minimalResult));
    sessionStorage.setItem('pullim:analyze-demo', '1');
    clearAnalyzeResult();
    expect(sessionStorage.getItem('pullim:analyze-result')).toBeNull();
    expect(sessionStorage.getItem('pullim:analyze-demo')).toBeNull();
  });
});

// ── toResultViewModel 매핑 ────────────────────────────────────────────────

describe('toResultViewModel', () => {
  it('진단: UPPERCASE → lowercase 역량 매핑', () => {
    const vm = toResultViewModel(minimalResult);
    expect(vm.diagnosis).toHaveLength(3);
    expect(vm.diagnosis[0].competency).toBe('academic');
    expect(vm.diagnosis[1].competency).toBe('career');
    expect(vm.diagnosis[2].competency).toBe('community');
  });

  it('진단: competencyLabelText 한국어 레이블', () => {
    const vm = toResultViewModel(minimalResult);
    expect(vm.diagnosis[0].competencyLabelText).toBe('학업역량');
    expect(vm.diagnosis[1].competencyLabelText).toBe('진로역량');
    expect(vm.diagnosis[2].competencyLabelText).toBe('공동체역량');
  });

  it('진단: 총평·강점·보완·다음 할 일·evidence 보존', () => {
    const vm = toResultViewModel(minimalResult);
    const acad = vm.diagnosis[0];
    expect(acad.summary).toBe('학업 매핑 총평입니다.');
    expect(acad.strengths).toEqual([{ title: '수학 세특 우수', detail: '수학 세특 우수 상세' }]);
    expect(acad.gaps).toEqual([{ title: '탐구 기록 부족', detail: '탐구 기록 부족 상세' }]);
    expect(acad.nextSteps).toEqual(['학업 매핑 다음 할 일']);
    expect(acad.evidence).toHaveLength(1);
    expect(acad.evidence[0].quote).toBe('자료구조 발표');
    expect(acad.evidence[0].section).toBe('세특-정보');
  });

  it('보완: rubric 아이템 매핑 + 역량 lowercase', () => {
    const vm = toResultViewModel(minimalResult);
    expect(vm.improvements).toHaveLength(1);
    const item = vm.improvements[0];
    expect(item.recordArea).toBe('SETUK');
    expect(item.competency).toBe('academic');
    expect(item.text).toBe('수학 심화 탐구를 세특에 드러낼 것');
    expect(item.estimatedMinutes).toBe(60);
    expect(item.linkedQuestions).toEqual(['Q1']);
    expect(item.evidence.quote).toBe('자료구조 발표');
  });

  it('면접 없으면 빈 배열', () => {
    const vm = toResultViewModel(minimalResult);
    expect(vm.interview).toHaveLength(0);
  });

  it('면접: 질문·근거·방향·꼬리질문 보존', () => {
    const vm = toResultViewModel(withInterviewResult);
    expect(vm.interview).toHaveLength(1);
    const q = vm.interview[0];
    expect(q.question).toBe('가장 의미 있는 활동은?');
    expect(q.format).toBe('record_based');
    expect(q.pressure).toBe(false);
    expect(q.evidence).toEqual([{ quote: '코딩 동아리 산출물', section: '창체-동아리' }]);
    expect(q.answerDirection).toBe('과정과 배움 중심으로 답할 것');
    expect(q.followups).toHaveLength(2);
  });

  // 스키마 확장 전에 생성돼 보존 30일 동안 남는 결과 — 폴백이 없으면 화면이 깨진다.
  describe('구버전 결과 폴백', () => {
    it('진단 strength/weakness(단수 문자열) → strengths/gaps 카드 1건', () => {
      const legacy = {
        ...minimalResult,
        diagnosis: {
          criteria: [
            {
              key: 'ACADEMIC',
              mapping: '학업 매핑',
              strength: '수학 세특 우수',
              weakness: '탐구 기록 부족',
              evidence: [],
            },
          ],
        },
      } as unknown as AnalyzeResult;
      const acad = toResultViewModel(legacy).diagnosis[0];
      expect(acad.strengths).toEqual([{ title: '수학 세특 우수', detail: '' }]);
      expect(acad.gaps).toEqual([{ title: '탐구 기록 부족', detail: '' }]);
      expect(acad.summary).toBe('');
      expect(acad.nextSteps).toEqual([]);
    });

    it('면접 basis(단수 근거) → evidence 배열 1건, format 은 record_based', () => {
      const legacy = {
        ...minimalResult,
        interview: {
          questions: [
            {
              question: '가장 의미 있는 활동은?',
              basis: { quote: '코딩 동아리 산출물', section: '창체-동아리' },
              answerDirection: '과정 중심',
              followups: [],
            },
          ],
        },
      } as unknown as AnalyzeResult;
      const q = toResultViewModel(legacy).interview[0];
      expect(q.evidence).toEqual([{ quote: '코딩 동아리 산출물', section: '창체-동아리' }]);
      expect(q.format).toBe('record_based');
      expect(q.pressure).toBe(false);
    });

    it('보완 소요시간·연결질문 없으면 undefined·빈 배열', () => {
      const legacy = {
        ...minimalResult,
        rubric: {
          ...minimalResult.rubric,
          items: [
            {
              recordArea: 'SETUK',
              competency: 'ACADEMIC',
              text: '정리할 것',
              rationale: '보강',
              evidence: { quote: '발표', section: '세특' },
            },
          ],
        },
      } as unknown as AnalyzeResult;
      const item = toResultViewModel(legacy).improvements[0];
      expect(item.estimatedMinutes).toBeUndefined();
      expect(item.linkedQuestions).toEqual([]);
    });
  });

  it('roadmap 없으면 undefined', () => {
    const vm = toResultViewModel(minimalResult);
    expect(vm.roadmap).toBeUndefined();
  });

  it('fit 없으면 undefined', () => {
    const vm = toResultViewModel(minimalResult);
    expect(vm.fit).toBeUndefined();
  });
});
