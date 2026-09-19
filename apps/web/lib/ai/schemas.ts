// 진단/면접/처방 출력 스키마(zod).
//
// ⚠️ SSOT 는 `pullim-api/src/admissions/engine/schemas.ts` 다(ADR-058 로 진단 실행이 백엔드로
// 이전). 이 파일은 그 계약의 FE 사본이며 — AnalyzeResult 타입의 출처이자 결과 화면 뷰모델의
// 기준이다 — 백엔드를 고치면 여기도 같이 고친다.
import { z } from 'zod/v4'

export const EvidenceRefSchema = z.object({ quote: z.string(), section: z.string() })

/** 강점·보완 한 건 — 제목(한 줄 요약)과 설명(근거 수치·항목)을 분리해 카드로 렌더한다. */
const FindingSchema = z.object({ title: z.string(), detail: z.string() })

export const DiagnosisSchema = z.object({
  /**
   * 생기부 전반에서 반복되는 주제 태그 — 보완 탭 상단 키워드 묶음.
   * 단어 빈도가 아니라 주제 묶음이라 결정론 추출로는 재현되지 않는다(진단 호출에서 함께 받는다).
   */
  keywords: z.array(z.object({ label: z.string(), count: z.number().int().min(1) })).min(5).max(12),
  criteria: z.array(z.object({
    key: z.enum(['ACADEMIC', 'CAREER', 'COMMUNITY']),
    mapping: z.string(),
    /** 역량별 총평 한 문단 — 강점·보완을 읽기 전에 상태를 요약한다. */
    summary: z.string(),
    strengths: z.array(FindingSchema).min(1),
    gaps: z.array(FindingSchema).min(1),
    /** 학생 본인이 앞으로 할 일(입시 전 시점). */
    nextSteps: z.array(z.string()).min(1),
    evidence: z.array(EvidenceRefSchema),
  })),
})
export type Diagnosis = z.infer<typeof DiagnosisSchema>

/** 면접 유형 — 목표 대학·계열 KB(`interview-formats.ts`)가 산출한 값 중 하나. */
export const InterviewFormatSchema = z.enum(['record_based', 'passage_based', 'mmi'])

export const InterviewPackSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    format: InterviewFormatSchema,
    /** 압박 질문 여부 — 유형이 아니라 방식이라 별도 플래그. 화면에서 구분 표시한다. */
    pressure: z.boolean(),
    /**
     * 질문의 근거가 된 실제 생기부 항목(입력에 등장하는 인용). 날조 금지.
     * record_based 는 1건 이상, passage_based·mmi 는 빈 배열.
     */
    evidence: z.array(EvidenceRefSchema),
    /** 답변 "방향"(핵심 포인트·논리)만. 완성 대본/합격 답변 금지. */
    answerDirection: z.string(),
    followups: z.array(z.string()),
  })).min(8).max(10)
    // §6: record_based 질문은 생기부 근거가 반드시 있어야 한다. 백엔드 SSOT 와 동일한 보증.
    .refine(
      (qs) => qs.every((q) => q.format !== 'record_based' || q.evidence.length >= 1),
      { message: 'record_based 질문에는 생기부 근거(evidence)가 1건 이상 필요합니다.' },
    ),
})
export type InterviewPack = z.infer<typeof InterviewPackSchema>

export const ActionCandidatesSchema = z.object({
  candidates: z.array(z.object({
    recordArea: z.string(),
    competency: z.enum(['ACADEMIC', 'CAREER', 'COMMUNITY']),
    text: z.string(),
    rationale: z.string(),
    /** 학생이 혼자 수행하는 데 드는 예상 시간(분). 화면에 "약 60분"으로 표시. */
    estimatedMinutes: z.number().int().min(10).max(240),
    /** 이 보완이 대비하는 면접 질문 번호(예: "Q1"). 없으면 빈 배열. */
    linkedQuestions: z.array(z.string()),
    evidence: EvidenceRefSchema.nullable(),
  })),
})
export type ActionCandidatesOut = z.infer<typeof ActionCandidatesSchema>
