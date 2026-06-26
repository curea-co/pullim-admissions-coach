import { z } from 'zod/v4'

export const EvidenceRefSchema = z.object({ quote: z.string(), section: z.string() })

export const DiagnosisSchema = z.object({
  criteria: z.array(z.object({
    key: z.enum(['ACADEMIC', 'CAREER', 'COMMUNITY']),
    mapping: z.string(),
    strength: z.string(),
    weakness: z.string(),
    evidence: z.array(EvidenceRefSchema),
  })),
})
export type Diagnosis = z.infer<typeof DiagnosisSchema>

export const InterviewPackSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    /** 질문의 근거가 된 실제 생기부 항목(입력에 등장하는 인용). 날조 금지. */
    basis: EvidenceRefSchema,
    /** 답변 "방향"(핵심 포인트·논리)만. 완성 대본/합격 답변 금지. */
    answerDirection: z.string(),
    followups: z.array(z.string()),
  })).min(3).max(5),
})
export type InterviewPack = z.infer<typeof InterviewPackSchema>

export const ActionCandidatesSchema = z.object({
  candidates: z.array(z.object({
    recordArea: z.string(),
    competency: z.enum(['ACADEMIC', 'CAREER', 'COMMUNITY']),
    text: z.string(),
    rationale: z.string(),
    evidence: EvidenceRefSchema.nullable(),
  })),
})
export type ActionCandidatesOut = z.infer<typeof ActionCandidatesSchema>
