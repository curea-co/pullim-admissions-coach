import { describe, it, expect } from 'vitest'
import { StudentProfileSchema } from './profile'

describe('StudentProfileSchema', () => {
  const base = {
    admissionYear: 2024, track5: 'natural', targetRegion: 'metro',
    schoolType: 'general', grade: 3, saengbu: '세특: 미적분 탐구...',
    consent: { sensitive: true, guardian: false },
  }
  it('accepts a valid profile', () => {
    expect(StudentProfileSchema.parse(base).admissionYear).toBe(2024)
  })
  it('rejects missing admissionYear', () => {
    const { admissionYear, ...rest } = base
    expect(() => StudentProfileSchema.parse(rest)).toThrow()
  })
  it('rejects sensitive consent !== true', () => {
    expect(() => StudentProfileSchema.parse({ ...base, consent: { sensitive: false, guardian: false } })).toThrow()
  })
})
