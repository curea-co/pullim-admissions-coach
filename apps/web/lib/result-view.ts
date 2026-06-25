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

export function saveAnalyzeResult(r: AnalyzeResult): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(r));
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
