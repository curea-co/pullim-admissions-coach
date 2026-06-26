'use client';

/**
 * 출력 어댑터: AnalyzeResult → 결과 UI 뷰모델.
 *
 * - sessionStorage 영속화(submitted-profile 패턴 모방)
 * - UPPERCASE 역량(engine) → lowercase(shared competencyLabel) 매핑
 * - §6 준수: 합격%·점수·완성 대본 금지, 답변 방향만 노출
 */

import { competencyLabel, type Competency as SharedCompetency } from '@pullim/shared';
import type { AnalyzeResult } from './analyze';
import type { Roadmap } from '@pullim/engine';
import type { FitAssessment } from './fit';

// ── sessionStorage 키 ──────────────────────────────────────────────────────

const STORAGE_KEY = 'pullim:analyze-result';
// 키 없이 생성된 mock 결과(데모) 여부. 결과 화면에서 정직 고지에 사용(§6).
const DEMO_KEY = 'pullim:analyze-demo';

export function saveAnalyzeResult(r: AnalyzeResult, demo = false): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    // 항상 동기화: 직전 데모 플래그가 실결과에 남지 않도록 매 저장 시 덮어쓴다.
    window.sessionStorage.setItem(DEMO_KEY, demo ? '1' : '0');
  } catch {
    // sessionStorage 비가용(프라이빗 모드 등) — 무시.
  }
}

export function loadAnalyzeResult(): AnalyzeResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnalyzeResult;
  } catch {
    return null;
  }
}

/** 저장된 결과가 키 없는 데모(mock)로 생성됐는지. 미저장이면 false. */
export function loadAnalyzeDemo(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

// ── 역량 키 매핑 ──────────────────────────────────────────────────────────

/** engine UPPERCASE → shared lowercase */
const COMP_KEY_MAP: Record<'ACADEMIC' | 'CAREER' | 'COMMUNITY', SharedCompetency> = {
  ACADEMIC: 'academic',
  CAREER: 'career',
  COMMUNITY: 'community',
};

// ── 뷰모델 타입 ──────────────────────────────────────────────────────────

export interface InterviewQuestionView {
  question: string;
  /** 근거 생기부 항목(quote + section) */
  basisQuote: string;
  basisSection: string;
  /** 답변 방향(핵심 포인트만 — 완성 대본 아님) */
  answerDirection: string;
  followups: string[];
}

export interface DiagnosisCriterionView {
  /** lowercase 역량 키 (competencyLabel 인덱스) */
  competency: SharedCompetency;
  competencyLabelText: string;
  mapping: string;
  strength: string;
  weakness: string;
  evidence: { quote: string; section: string }[];
}

export interface ImprovementItemView {
  recordArea: string;
  /** lowercase 역량 키 */
  competency: SharedCompetency;
  text: string;
  rationale: string;
  evidence: { quote: string; section: string };
}

export interface ResultViewModel {
  interview: InterviewQuestionView[];
  diagnosis: DiagnosisCriterionView[];
  improvements: ImprovementItemView[];
  roadmap?: Roadmap;
  fit?: FitAssessment;
}

// ── 매퍼 ──────────────────────────────────────────────────────────────────

/**
 * AnalyzeResult → ResultViewModel.
 * 실 데이터가 없는 옵셔널 필드(interview, roadmap, fit)는 undefined로 남긴다.
 */
export function toResultViewModel(r: AnalyzeResult): ResultViewModel {
  // 면접
  const interview: InterviewQuestionView[] = (r.interview?.questions ?? []).map((q) => ({
    question: q.question,
    basisQuote: q.basis.quote,
    basisSection: q.basis.section,
    answerDirection: q.answerDirection,
    followups: q.followups,
  }));

  // 진단
  const diagnosis: DiagnosisCriterionView[] = r.diagnosis.criteria.map((c) => {
    const key = COMP_KEY_MAP[c.key];
    return {
      competency: key,
      competencyLabelText: competencyLabel[key],
      mapping: c.mapping,
      strength: c.strength,
      weakness: c.weakness,
      evidence: c.evidence.map((e) => ({ quote: e.quote, section: e.section })),
    };
  });

  // 보완(rubric)
  const improvements: ImprovementItemView[] = r.rubric.items.map((item) => {
    const key = COMP_KEY_MAP[item.competency];
    return {
      recordArea: item.recordArea,
      competency: key,
      text: item.text,
      rationale: item.rationale,
      evidence: { quote: item.evidence.quote, section: item.evidence.section },
    };
  });

  return {
    interview,
    diagnosis,
    improvements,
    roadmap: r.roadmap,
    fit: r.fit,
  };
}
