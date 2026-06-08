import { z } from 'zod'

export const StudentProfileSchema = z.object({
  admissionYear: z.number().int().min(2024).max(2030),
  track5: z.enum(['humanities', 'social', 'natural', 'engineering', 'arts_athletics']),
  targetRegion: z.enum(['metro', 'non_metro', 'unknown']),
  schoolType: z.enum(['general', 'autonomous', 'special_purpose', 'vocational']),
  grade: z.number().int().min(1).max(3),
  saengbu: z.string().min(1, '생기부 내용이 필요합니다'),
  consent: z.object({
    sensitive: z.literal(true), // §23 민감정보 별도 동의 필수
    guardian: z.boolean(),      // 만14세 미만 시 true 요구(라우트에서 검사)
  }),
})
export type StudentProfile = z.infer<typeof StudentProfileSchema>
