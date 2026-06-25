import { describe, it, expect } from 'vitest'
import { maskPII } from './mask'

describe('maskPII', () => {
  it('전화번호 마스킹', () => {
    expect(maskPII('연락처 010-1234-5678 입니다')).not.toContain('1234-5678')
  })
  it('주민번호 패턴 마스킹', () => {
    expect(maskPII('051010-3000000')).not.toContain('3000000')
  })
  it('이메일 마스킹', () => {
    expect(maskPII('hong@school.kr')).not.toContain('hong@school.kr')
  })
  it('일반 생기부 텍스트는 보존', () => {
    const t = '세특: 미적분 함수의 극한을 탐구함'
    expect(maskPII(t)).toBe(t)
  })
})
