import { describe, it, expect } from 'vitest';
import { recordSchema } from './schemas';

const base = { inputType: 'text_paste' as const, maskingApplied: true as const };

describe('recordSchema — block-tier PII 게이트', () => {
  it('전화번호가 남은 text는 invalid', () => {
    const r = recordSchema.safeParse({ ...base, text: '연락처 010-1234-5678' });
    expect(r.success).toBe(false);
  });
  it('학교명이 남은 text는 invalid', () => {
    const r = recordSchema.safeParse({ ...base, text: '서울고등학교 재학 중' });
    expect(r.success).toBe(false);
  });
  it('warn-tier만(이름) 있으면 valid (스키마는 차단 안 함)', () => {
    const r = recordSchema.safeParse({ ...base, text: '이름: 홍길동, 동아리 활동 우수' });
    expect(r.success).toBe(true);
  });
  it('PII 없는 text는 valid', () => {
    const r = recordSchema.safeParse({ ...base, text: '자료구조 발표와 동아리 활동' });
    expect(r.success).toBe(true);
  });
});
