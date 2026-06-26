import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveAnalyzeResult, loadAnalyzeResult, loadAnalyzeDemo, clearAnalyzeResult, toResultViewModel } from './result-view';
import type { AnalyzeResult } from './analyze';
import type { CohortResult } from '@pullim/shared';

// ── 최소 픽스처 ────────────────────────────────────────────────────────────

const cohort: CohortResult = { system: '2028_new', track: 'core', region: 'unknown', emphasizeSetuk: true };

const minimalResult: AnalyzeResult = {
  cohort,
  diagnosis: {
    criteria: [
      {
        key: 'ACADEMIC',
        mapping: '학업 매핑',
        strength: '수학 세특 우수',
        weakness: '탐구 기록 부족',
        evidence: [{ quote: '자료구조 발표', section: '세특-정보' }],
      },
      {
        key: 'CAREER',
        mapping: '진로 매핑',
        strength: '진로 방향 명확',
        weakness: '시도 기록 미흡',
        evidence: [],
      },
      {
        key: 'COMMUNITY',
        mapping: '공동체 매핑',
        strength: '성실성 우수',
        weakness: '리더십 기록 부족',
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
        basis: { quote: '코딩 동아리 산출물', section: '창체-동아리' },
        answerDirection: '과정과 배움 중심으로 답할 것',
        followups: ['가장 어려웠던 점은?', '다음에 또 하겠냐?'],
      },
    ],
  },
};

// ── sessionStorage 라운드트립 ──────────────────────────────────────────────

describe('saveAnalyzeResult / loadAnalyzeResult', () => {
  beforeEach(() => sessionStorage.clear());

  it('저장 전에는 null 반환', () => {
    expect(loadAnalyzeResult()).toBeNull();
  });

  it('저장 후 동일 객체 복원', () => {
    saveAnalyzeResult(minimalResult);
    const loaded = loadAnalyzeResult();
    expect(loaded).not.toBeNull();
    expect(loaded!.cohort.system).toBe('2028_new');
    expect(loaded!.diagnosis.criteria).toHaveLength(3);
    expect(loaded!.rubric.items).toHaveLength(1);
  });

  it('덮어쓰기 후 최신 값 반환', () => {
    saveAnalyzeResult(minimalResult);
    const updated: AnalyzeResult = {
      ...minimalResult,
      cohort: { system: '2027_old', track: 'beachhead', region: 'unknown', emphasizeSetuk: false },
    };
    saveAnalyzeResult(updated);
    expect(loadAnalyzeResult()!.cohort.system).toBe('2027_old');
  });

  it('clearAnalyzeResult: 결과 + 데모 플래그 모두 제거(이전 결과 오표시 방지)', () => {
    saveAnalyzeResult(minimalResult, true);
    expect(loadAnalyzeResult()).not.toBeNull();
    expect(loadAnalyzeDemo()).toBe(true);
    clearAnalyzeResult();
    expect(loadAnalyzeResult()).toBeNull();
    expect(loadAnalyzeDemo()).toBe(false);
  });
});

// ── 데모 플래그(§6 정직 고지) ───────────────────────────────────────────────

describe('loadAnalyzeDemo', () => {
  beforeEach(() => sessionStorage.clear());

  it('미저장이면 false', () => {
    expect(loadAnalyzeDemo()).toBe(false);
  });

  it('demo=true 저장 시 true (mock 결과도 viewModel은 로드되므로 플래그로 고지)', () => {
    saveAnalyzeResult(minimalResult, true);
    expect(loadAnalyzeResult()).not.toBeNull();
    expect(loadAnalyzeDemo()).toBe(true);
  });

  it('기본값(실결과)은 false', () => {
    saveAnalyzeResult(minimalResult);
    expect(loadAnalyzeDemo()).toBe(false);
  });

  it('데모 저장 후 실결과로 덮어쓰면 플래그도 해제(잔존 금지)', () => {
    saveAnalyzeResult(minimalResult, true);
    expect(loadAnalyzeDemo()).toBe(true);
    saveAnalyzeResult(minimalResult, false);
    expect(loadAnalyzeDemo()).toBe(false);
  });
});

// ── 저장 fail-closed(결과 유실 방지) ────────────────────────────────────────

describe('saveAnalyzeResult 반환값', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('성공 시 true', () => {
    expect(saveAnalyzeResult(minimalResult)).toBe(true);
  });

  it('setItem이 조용히 실패하면 false(호출자 fail-closed 유도)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    expect(saveAnalyzeResult(minimalResult)).toBe(false);
  });

  it('데모 플래그 키만 실패해도 false(부분 성공 차단 → 데모 고지 누락 방지)', () => {
    const orig = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      k: string,
      v: string
    ) {
      if (k === 'pullim:analyze-demo') return; // 데모 키 쓰기만 실패 모사
      orig.call(this, k, v);
    });
    expect(saveAnalyzeResult(minimalResult, true)).toBe(false);
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

  it('진단: strength/weakness/evidence 보존', () => {
    const vm = toResultViewModel(minimalResult);
    const acad = vm.diagnosis[0];
    expect(acad.strength).toBe('수학 세특 우수');
    expect(acad.weakness).toBe('탐구 기록 부족');
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
    expect(q.basisQuote).toBe('코딩 동아리 산출물');
    expect(q.basisSection).toBe('창체-동아리');
    expect(q.answerDirection).toBe('과정과 배움 중심으로 답할 것');
    expect(q.followups).toHaveLength(2);
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
