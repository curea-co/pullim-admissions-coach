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

/**
 * 분석 결과를 저장하고 **쓰기 성공 여부**를 반환한다.
 * false면 호출자는 제출 데이터를 지우거나 /result로 이동하지 말아야 한다(fail-closed):
 * 실 분석이 성공했는데 결과 저장이 조용히 실패하면, /result가 결과 없음으로 보고
 * 데모를 표시하고 제출 데이터까지 지워져 재시도도 막힌다.
 */
export function saveAnalyzeResult(r: AnalyzeResult, demo = false): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const serialized = JSON.stringify(r);
    const demoFlag = demo ? '1' : '0';
    window.sessionStorage.setItem(STORAGE_KEY, serialized);
    // 항상 동기화: 직전 데모 플래그가 실결과에 남지 않도록 매 저장 시 덮어쓴다.
    window.sessionStorage.setItem(DEMO_KEY, demoFlag);
    // 쓰기 검증(프라이빗 모드/쿼터 초과 등에서 setItem이 조용히 실패할 수 있음).
    // 두 키 모두 검증: DEMO_KEY만 실패해도 /result가 mock을 실결과처럼 렌더(데모 고지
    // 누락)할 수 있으므로 부분 성공을 false로 본다.
    return (
      window.sessionStorage.getItem(STORAGE_KEY) === serialized &&
      window.sessionStorage.getItem(DEMO_KEY) === demoFlag
    );
  } catch {
    // sessionStorage 비가용(프라이빗 모드 등) — 저장 실패로 보고.
    return false;
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

/**
 * 저장된 분석 결과를 제거. 새 분석을 시작하기 전 반드시 호출해,
 * 분석이 진행 중이거나 실패한 상태에서 /result가 이전 학생의 결과를
 * 개인화 결과처럼 표시하는 것을 막는다.
 */
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
