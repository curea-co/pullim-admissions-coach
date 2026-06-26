import { z } from 'zod'

export const analysisInputSchema = z.object({
  admissionYear: z.number().int().min(2024).max(2030),
  track5: z.enum(['humanities', 'social', 'natural', 'engineering', 'arts_athletics']),
  targetRegion: z.enum(['metro', 'non_metro', 'unknown']),
  schoolType: z.enum(['general', 'autonomous', 'special_purpose', 'vocational']),
  grade: z.number().int().min(1).max(3),
  // 목표 대학(선택, 최대 3) — KB 수록 대학은 검증된 평가기준을, 미수록은 정직 폴백을 받는다.
  targetUniversities: z.array(z.string().trim().min(1).max(40)).max(3).optional(),
  saengbu: z.string().min(1, '생기부 내용이 필요합니다'),
  consent: z.object({
    sensitive: z.literal(true), // §23 민감정보 별도 동의 필수
    guardian: z.boolean(),      // 만14세 미만 시 true 요구(라우트에서 검사)
  }),
  // 종단 트윈(선택) — 이전 학기 생기부가 있으면 2학기 비교(처방 안착) 분석을 수행한다.
  // 없으면 단일 학기 경로(기존과 100% 동일)로 동작한다.
  priorSaengbu: z.string().min(1).optional(), // 이전 학기 생기부 원문
  priorTerm: z.string().optional(),           // 예: '이전 학기'(기본값)
  currentTerm: z.string().optional(),         // 예: '이번 학기'(기본값)
})
export type AnalysisInput = z.infer<typeof analysisInputSchema>
