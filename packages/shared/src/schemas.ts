// Pullim Admissions Coach — shared Zod schemas
// SSOT: docs/student_profile_schema_v0.1.json (JSON Schema draft 2020-12)
//       docs/002_Admissions_Coach_definition_v.3.md §3 (입력 5항목) + §6.3 (가드레일)
//
// 본 파일을 변경할 때는 위 두 SSOT와 정합을 다시 확인할 것.
// 가드레일 강제 (§6.3):
//   - record.maskingApplied: 항상 true (literal)
//   - consent.termsAgreed / privacyPolicyAgreed: 항상 true (literal)
//   - consent.isMinor=true → guardianConsentObtained=true 강제 (refine)

import { z } from 'zod';
import { hasBlockingPii } from './pii';

export const SCHEMA_VERSION = '0.1' as const;

// ── enums ────────────────────────────────────────────────────────────
// 정의 v0.3.1 §3-2: 5계열 (4→5 확장, 2026-05-29)
export const targetTrackEnum = z.enum([
  'humanities',          // 인문
  'science_engineering', // 이공 (자연과학 + 공학)
  'medical',             // 의치한
  'arts_athletics',      // 예체능
  'undeclared',          // 무전공(전공자율)
  'other',               // 기타
]);
export type TargetTrack = z.infer<typeof targetTrackEnum>;

// 정의 v0.3.1 §3-4: 4종 (3→4 확장, 2026-05-29)
export const schoolTypeEnum = z.enum([
  'general',          // 일반고
  'special_purpose',  // 특목고
  'autonomous',       // 자사고·자율고
  'ged',              // 검정고시
]);
export type SchoolType = z.infer<typeof schoolTypeEnum>;

export const maskedFieldEnum = z.enum([
  'student_name',
  'school_name',
  'birth_date',
  'resident_registration_no',
  'phone',
  'address',
  'teacher_name',
  'email',
  'other',
]);

// ── 한국어 라벨 (UI에서 사용) ─────────────────────────────────────────
export const targetTrackLabel: Record<TargetTrack, string> = {
  humanities: '인문',
  science_engineering: '이공',
  medical: '의치한',
  arts_athletics: '예체능',
  undeclared: '무전공(전공자율)',
  other: '기타',
};

export const schoolTypeLabel: Record<SchoolType, string> = {
  general: '일반고',
  special_purpose: '특목고',
  autonomous: '자사고·자율고',
  ged: '검정고시',
};

// ── record (생기부 입력) — discriminated union ───────────────────────
const maskingLiteral = z.literal(true, {
  errorMap: () => ({ message: '식별정보 마스킹을 적용했는지 확인해주세요' }),
});

const baseRecord = {
  maskingApplied: maskingLiteral,
  maskedFields: z.array(maskedFieldEnum).optional(),
};

export const recordSchema = z
  .discriminatedUnion('inputType', [
    z.object({
      inputType: z.literal('pdf_upload'),
      fileRef: z.string().min(1, '파일을 업로드해주세요'),
      ...baseRecord,
    }),
    z.object({
      inputType: z.literal('text_paste'),
      text: z
        .string()
        .min(1, '생기부 텍스트를 입력해주세요')
        .max(200000, '본문이 너무 깁니다(최대 20만 자)'),
      ...baseRecord,
    }),
  ])
  .superRefine((rec, ctx) => {
    // block-tier(전화·주민번호·이메일·학교명) 잔존 시 제출 차단. warn-tier는 UI 처리.
    if (rec.inputType === 'text_paste' && hasBlockingPii(rec.text)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['text'],
        message: '전화·주민번호·이메일·학교명 등 식별정보가 남아있어요. 자동 가림을 적용해주세요.',
      });
    }
  });

// ── targetUniversities (선택, 최대 3) ─────────────────────────────────
export const targetUniversitySchema = z.object({
  name: z
    .string()
    .min(1, '대학명을 입력해주세요')
    .max(100, '대학명이 너무 깁니다'),
  department: z.string().max(100).optional(),
});

// ── currentStanding (학년·학기·학교유형) ─────────────────────────────
export const currentStandingSchema = z.object({
  grade: z
    .number()
    .int()
    .min(1, '학년은 1~3 사이여야 합니다')
    .max(3, '학년은 1~3 사이여야 합니다'),
  semester: z.union([z.literal(1), z.literal(2)]),
  schoolType: schoolTypeEnum,
});

// ── consent (정의 §6.3 가드레일, P0 출시 차단 조건) ───────────────────
const trueLiteral = (message: string) =>
  z.literal(true, { errorMap: () => ({ message }) });

export const consentSchema = z
  .object({
    isMinor: z.boolean(),
    termsAgreed: trueLiteral('이용약관에 동의해주세요'),
    privacyPolicyAgreed: trueLiteral('개인정보 수집·이용에 동의해주세요'),
    guardianConsentObtained: z.boolean(),
    guardianContactRef: z.string().optional(),
    consentTimestamp: z.string().datetime({ message: '잘못된 시각 형식입니다' }),
  })
  .refine(
    (d) => !d.isMinor || d.guardianConsentObtained === true,
    {
      message: '미성년자는 법정대리인 동의가 필요합니다',
      path: ['guardianConsentObtained'],
    }
  );

// ── 학생 프로필 (전체) ───────────────────────────────────────────────
export const studentProfileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  record: recordSchema,
  targetTrack: targetTrackEnum,
  targetUniversities: z.array(targetUniversitySchema).max(3).optional(),
  currentStanding: currentStandingSchema,
  selfReportedWeakAreas: z
    .string()
    .max(2000, '2000자 이내로 입력해주세요')
    .optional(),
  consent: consentSchema,
  dataRetention: z
    .object({
      retentionPolicyVersion: z.string().optional(),
      deleteAfter: z.string().datetime().optional(),
    })
    .optional(),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;
export type TargetUniversity = z.infer<typeof targetUniversitySchema>;
export type CurrentStanding = z.infer<typeof currentStandingSchema>;
export type Consent = z.infer<typeof consentSchema>;
export type StudentRecord = z.infer<typeof recordSchema>;
