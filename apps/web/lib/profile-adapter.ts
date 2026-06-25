/**
 * profile-adapter.ts
 *
 * Maps a validated `StudentProfile` (submit-form payload, packages/shared `studentProfileSchema`)
 * to `AnalysisInput` (AI pipeline input, packages/shared `analysisInputSchema`).
 *
 * All mapping decisions are documented inline.
 */
import {
  analysisInputSchema,
  type AnalysisInput,
  type StudentProfile,
} from '@pullim/shared'

// ── track5 mapping ───────────────────────────────────────────────────────────
// Source: targetTrackEnum ('humanities'|'science_engineering'|'medical'|
//                          'arts_athletics'|'undeclared'|'other')
// Target: track5 enum  ('humanities'|'social'|'natural'|'engineering'|'arts_athletics')
const TRACK5_MAP: Record<StudentProfile['targetTrack'], AnalysisInput['track5']> = {
  humanities:          'humanities',
  science_engineering: 'engineering', // 이공 → engineering
  medical:             'natural',     // 의치한 → natural (의·치·한약 계열, 자연계 상위)
  arts_athletics:      'arts_athletics',
  undeclared:          'social',      // 무전공 → social (최선 근사)
  other:               'social',      // 기타 → social (최선 근사)
}

// ── schoolType mapping ───────────────────────────────────────────────────────
// Source: schoolTypeEnum ('general'|'special_purpose'|'autonomous'|'ged')
// Target: schoolType    ('general'|'autonomous'|'special_purpose'|'vocational')
// Notes:
//   - 'general', 'special_purpose', 'autonomous' are 1:1 exact matches.
//   - 'ged' (검정고시) → 'vocational': closest available target value; no
//     exact analogue exists in AnalysisInput's enum (vocational is the catch-all
//     for non-standard schooling paths including GED equivalency).
const SCHOOL_TYPE_MAP: Record<
  StudentProfile['currentStanding']['schoolType'],
  AnalysisInput['schoolType']
> = {
  general:         'general',
  special_purpose: 'special_purpose',
  autonomous:      'autonomous',
  ged:             'vocational', // ⚠ nearest fit — see note above
}

// ── main adapter ─────────────────────────────────────────────────────────────

/**
 * Convert a `StudentProfile` submit payload into an `AnalysisInput` for the AI pipeline.
 *
 * @param payload     Validated StudentProfile (from `studentProfileSchema.parse`).
 * @param currentYear Academic reference year (defaults to current calendar year).
 *                    Pass an explicit value in tests for determinism.
 * @returns           `AnalysisInput` validated by `analysisInputSchema.parse`.
 * @throws            `ZodError` if the mapped output fails schema validation.
 */
export function toAnalysisInput(
  payload: StudentProfile,
  currentYear: number = new Date().getFullYear(),
): AnalysisInput {
  const { record, targetTrack, targetUniversities, currentStanding, consent } = payload

  // saengbu: the raw (masked) school record text
  // Only text_paste inputType carries `.text`; pdf_upload will not have it here
  // (upstream route is expected to resolve pdf→text before calling this adapter).
  const saengbu = record.inputType === 'text_paste' ? record.text : ''

  const raw = {
    admissionYear: currentYear - (currentStanding.grade - 1),
    track5: TRACK5_MAP[targetTrack],
    targetRegion: 'unknown' as const,
    schoolType: SCHOOL_TYPE_MAP[currentStanding.schoolType],
    grade: currentStanding.grade,
    targetUniversities:
      targetUniversities !== undefined
        ? targetUniversities.map((u) => u.name)
        : undefined,
    saengbu,
    consent: {
      sensitive: true as const,
      guardian: consent.isMinor,
    },
  }

  // Validate via Zod schema — throws ZodError on mismatch, ensuring the AI
  // pipeline always receives a well-typed, schema-conformant input.
  return analysisInputSchema.parse(raw)
}
