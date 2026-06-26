import { describe, it, expect } from 'vitest'
import { toAnalysisInput } from './profile-adapter'
import type { StudentProfile } from '@pullim/shared'

// Minimal valid StudentProfile fixture (text_paste variant)
function makeProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    schemaVersion: '0.1',
    record: {
      inputType: 'text_paste',
      text: '3학년 세특: 수학 심화 탐구 활동을 통해 적분의 응용을 탐색함.',
      maskingApplied: true,
    },
    targetTrack: 'science_engineering',
    targetUniversities: [{ name: '서울대', department: '컴퓨터공학부' }],
    currentStanding: {
      grade: 3,
      semester: 1,
      schoolType: 'special_purpose',
    },
    consent: {
      isMinor: false,
      termsAgreed: true,
      privacyPolicyAgreed: true,
      guardianConsentObtained: false,
      consentTimestamp: new Date().toISOString(),
    },
    ...overrides,
  } as StudentProfile
}

describe('toAnalysisInput', () => {
  it('grade 3 → admissionYear = currentYear (grade 3 → currentYear − 2)', () => {
    const result = toAnalysisInput(makeProfile(), 2026)
    // grade=3, currentYear=2026 → admissionYear = 2026 − (3 − 1) = 2024
    expect(result.admissionYear).toBe(2024)
  })

  it('targetTrack "science_engineering" → track5 "engineering"', () => {
    const result = toAnalysisInput(makeProfile({ targetTrack: 'science_engineering' }), 2026)
    expect(result.track5).toBe('engineering')
  })

  it('schoolType "special_purpose" → "special_purpose" (1:1)', () => {
    const result = toAnalysisInput(makeProfile(), 2026)
    expect(result.schoolType).toBe('special_purpose')
  })

  it('targetUniversities [{name, department}] → [name]', () => {
    const result = toAnalysisInput(
      makeProfile({ targetUniversities: [{ name: '서울대', department: 'x' }] }),
      2026,
    )
    expect(result.targetUniversities).toEqual(['서울대'])
  })

  it('record.text → saengbu', () => {
    const text = '생기부 원문 텍스트 샘플'
    const profile = makeProfile({
      record: { inputType: 'text_paste', text, maskingApplied: true },
    })
    expect(toAnalysisInput(profile, 2026).saengbu).toBe(text)
  })

  it('isMinor=true → consent.guardian=true', () => {
    const profile = makeProfile({
      consent: {
        isMinor: true,
        termsAgreed: true,
        privacyPolicyAgreed: true,
        guardianConsentObtained: true,
        consentTimestamp: new Date().toISOString(),
      },
    })
    const result = toAnalysisInput(profile, 2026)
    expect(result.consent.guardian).toBe(true)
  })

  it('isMinor=false → consent.guardian=false', () => {
    const result = toAnalysisInput(makeProfile(), 2026)
    expect(result.consent.guardian).toBe(false)
  })

  it('consent.sensitive is always true', () => {
    const result = toAnalysisInput(makeProfile(), 2026)
    expect(result.consent.sensitive).toBe(true)
  })

  it('targetRegion is always "unknown"', () => {
    const result = toAnalysisInput(makeProfile(), 2026)
    expect(result.targetRegion).toBe('unknown')
  })

  it('grade is mapped from currentStanding.grade', () => {
    const profile = makeProfile({ currentStanding: { grade: 1, semester: 2, schoolType: 'general' } })
    const result = toAnalysisInput(profile, 2026)
    expect(result.grade).toBe(1)
  })

  it('targetUniversities omitted when empty', () => {
    const profile = makeProfile({ targetUniversities: [] })
    const result = toAnalysisInput(profile, 2026)
    // Empty array maps to undefined or empty depending on implementation — schema accepts empty
    expect(result.targetUniversities).toEqual([])
  })

  it('targetUniversities omitted when not provided', () => {
    const profile = makeProfile({ targetUniversities: undefined })
    const result = toAnalysisInput(profile, 2026)
    expect(result.targetUniversities).toBeUndefined()
  })

  it('track5 mappings — all variants', () => {
    const cases: Array<[StudentProfile['targetTrack'], string]> = [
      ['humanities', 'humanities'],
      ['science_engineering', 'engineering'],
      ['medical', 'natural'],
      ['arts_athletics', 'arts_athletics'],
      ['undeclared', 'social'],
      ['other', 'social'],
    ]
    for (const [src, expected] of cases) {
      const result = toAnalysisInput(makeProfile({ targetTrack: src }), 2026)
      expect(result.track5, `${src} → ${expected}`).toBe(expected)
    }
  })

  it('schoolType mappings — all variants', () => {
    const cases: Array<[StudentProfile['currentStanding']['schoolType'], string]> = [
      ['general', 'general'],
      ['special_purpose', 'special_purpose'],
      ['autonomous', 'autonomous'],
      ['ged', 'vocational'],
    ]
    for (const [src, expected] of cases) {
      const profile = makeProfile({ currentStanding: { grade: 2, semester: 1, schoolType: src } })
      const result = toAnalysisInput(profile, 2026)
      expect(result.schoolType, `${src} → ${expected}`).toBe(expected)
    }
  })

  it('uses current year by default (no explicit currentYear)', () => {
    // grade=1 → admissionYear = thisYear − 0
    const profile = makeProfile({ currentStanding: { grade: 1, semester: 1, schoolType: 'general' } })
    const result = toAnalysisInput(profile)
    expect(result.admissionYear).toBe(new Date().getFullYear())
  })

  it('output passes analysisInputSchema validation', async () => {
    const { analysisInputSchema } = await import('@pullim/shared')
    const result = toAnalysisInput(makeProfile(), 2026)
    expect(() => analysisInputSchema.parse(result)).not.toThrow()
  })

  it('pdf_upload inputType throws with Korean guidance message', () => {
    const profile = makeProfile({
      record: { inputType: 'pdf_upload', fileRef: 'uploads/test.pdf', maskingApplied: false } as unknown as StudentProfile['record'],
    })
    expect(() => toAnalysisInput(profile, 2026)).toThrow(
      'PDF 업로드는 텍스트 추출 후 분석해 주세요(상위에서 처리 필요).',
    )
  })
})
