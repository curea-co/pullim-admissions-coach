import { z } from 'zod'

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
