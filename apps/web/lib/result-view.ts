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

// 레거시 세션 결과 저장소의 잔재. 결과 정본은 서버(diagnosis_results)이고 /result 는 거기서만
// 읽는다(ADR-058) — 여기 쓰는 코드는 더 이상 없다. 남긴 건 **지우는 쪽**뿐이다: 예전 배포가
// 열어 둔 탭에 값이 남아 있을 수 있어, 새 분석을 시작할 때 한 번 비운다.
const STORAGE_KEY = 'pullim:analyze-result';
const DEMO_KEY = 'pullim:analyze-demo';

/** 레거시 세션 저장소를 비운다. 새 분석 시작 전에 호출(이전 결과 잔존 방지). */
export function clearAnalyzeResult(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(DEMO_KEY);
  } catch {
    // 무시
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

export interface EvidenceView {
  quote: string;
  section: string;
}

/** 강점·보완 한 건 — 제목 + 설명. */
export interface FindingView {
  title: string;
  detail: string;
}

export type InterviewFormatView = 'record_based' | 'passage_based' | 'mmi';

/** 서버가 준 format 을 화면이 아는 값으로 좁힌다. 백엔드가 유형을 추가/개명해도
 *  뱃지가 빈 칸으로 렌더되지 않게 한다(DTO 는 런타임 스키마 검증을 거치지 않는다). */
const INTERVIEW_FORMATS: readonly InterviewFormatView[] = [
  'record_based',
  'passage_based',
  'mmi',
];
function toFormat(raw: unknown): InterviewFormatView {
  return INTERVIEW_FORMATS.includes(raw as InterviewFormatView)
    ? (raw as InterviewFormatView)
    : 'record_based';
}

export interface InterviewQuestionView {
  question: string;
  /** 면접 유형 — 목표 대학·계열 KB 산출값. 구버전 결과는 record_based 로 본다. */
  format: InterviewFormatView;
  /** 압박 질문 여부(유형과 별개 축). */
  pressure: boolean;
  /** 근거 생기부 항목. passage_based·mmi 는 빈 배열. */
  evidence: EvidenceView[];
  /** 답변 방향(핵심 포인트만 — 완성 대본 아님) */
  answerDirection: string;
  followups: string[];
}

export interface DiagnosisCriterionView {
  /** lowercase 역량 키 (competencyLabel 인덱스) */
  competency: SharedCompetency;
  competencyLabelText: string;
  mapping: string;
  /** 역량별 총평. 구버전 결과는 빈 문자열. */
  summary: string;
  strengths: FindingView[];
  gaps: FindingView[];
  /** 학생 본인이 입시 전에 할 일. 구버전 결과는 빈 배열. */
  nextSteps: string[];
  evidence: EvidenceView[];
}

export interface ImprovementItemView {
  recordArea: string;
  /** lowercase 역량 키 */
  competency: SharedCompetency;
  text: string;
  rationale: string;
  /** 예상 소요 시간(분). 구버전 결과는 undefined — 화면에서 뱃지를 숨긴다. */
  estimatedMinutes?: number;
  /** 대비하는 면접 질문 번호(["Q1"]). 구버전 결과는 빈 배열. */
  linkedQuestions: string[];
  evidence: EvidenceView;
}

/** 생기부 주제 태그 — 보완 탭 상단. 구버전 결과는 빈 배열. */
export interface KeywordView {
  label: string;
  count: number;
}

export interface ResultViewModel {
  interview: InterviewQuestionView[];
  diagnosis: DiagnosisCriterionView[];
  keywords: KeywordView[];
  improvements: ImprovementItemView[];
  roadmap?: Roadmap;
  fit?: FitAssessment;
}

// ── 매퍼 ──────────────────────────────────────────────────────────────────

// ── 구버전 결과 호환 ──────────────────────────────────────────────────────
//
// diagnosis_results 는 jsonb 라 스키마 확장에 마이그레이션이 없다. 대신 **보존 30일 동안**
// 확장 전에 생성된 결과가 그대로 남는다: 진단은 strength/weakness(단수 문자열), 면접은
// basis(단수 근거)를 갖고 신 필드가 없다. 폴백 없이 읽으면 그 결과들의 화면이 깨진다.
// 아래 두 타입은 "올 수도 있는 옛 모양"이며, 신 필드가 채워지면 쓰이지 않는다.

type LegacyDiagnosis = { keywords?: KeywordView[] };
type LegacyCriterion = { strength?: string; weakness?: string };
type LegacyQuestion = { basis?: EvidenceView };
type LegacyAction = { estimatedMinutes?: number; linkedQuestions?: string[] };

/** 단수 문자열 서술 → 카드 1건. 제목만 채우고 설명은 비운다(화면이 제목만 렌더). */
function findingsFromLegacy(text: string | undefined): FindingView[] {
  const trimmed = text?.trim();
  return trimmed ? [{ title: trimmed, detail: '' }] : [];
}

/**
 * AnalyzeResult → ResultViewModel.
 * 실 데이터가 없는 옵셔널 필드(interview, roadmap, fit)는 undefined로 남긴다.
 * 확장 전에 생성된 결과는 위 폴백으로 흡수한다.
 */
export function toResultViewModel(r: AnalyzeResult): ResultViewModel {
  // 면접
  const interview: InterviewQuestionView[] = (r.interview?.questions ?? []).map((q) => {
    const legacy = q as typeof q & LegacyQuestion;
    const evidence = q.evidence ?? (legacy.basis ? [legacy.basis] : []);
    return {
      question: q.question,
      format: toFormat(q.format),
      pressure: q.pressure ?? false,
      evidence: evidence.map((e) => ({ quote: e.quote, section: e.section })),
      answerDirection: q.answerDirection,
      followups: q.followups,
    };
  });

  // 진단
  const diagnosis: DiagnosisCriterionView[] = r.diagnosis.criteria.map((c) => {
    const key = COMP_KEY_MAP[c.key];
    const legacy = c as typeof c & LegacyCriterion;
    return {
      competency: key,
      competencyLabelText: competencyLabel[key],
      mapping: c.mapping,
      summary: c.summary ?? '',
      strengths: c.strengths ?? findingsFromLegacy(legacy.strength),
      gaps: c.gaps ?? findingsFromLegacy(legacy.weakness),
      nextSteps: c.nextSteps ?? [],
      evidence: c.evidence.map((e) => ({ quote: e.quote, section: e.section })),
    };
  });

  // 보완(rubric)
  const improvements: ImprovementItemView[] = r.rubric.items.map((item) => {
    const key = COMP_KEY_MAP[item.competency];
    const extra = item as typeof item & LegacyAction;
    return {
      recordArea: item.recordArea,
      competency: key,
      text: item.text,
      rationale: item.rationale,
      estimatedMinutes: extra.estimatedMinutes,
      linkedQuestions: extra.linkedQuestions ?? [],
      evidence: { quote: item.evidence.quote, section: item.evidence.section },
    };
  });

  const keywords = (r.diagnosis as typeof r.diagnosis & LegacyDiagnosis).keywords ?? [];

  return {
    interview,
    keywords,
    diagnosis,
    improvements,
    roadmap: r.roadmap,
    fit: r.fit,
  };
}
