import { describe, it, expect } from 'vitest';
import { assertCited, buildUncertaintyNote } from './evidence';
import type { PrescribedAction } from '@pullim/shared';

const action = (q: string): PrescribedAction =>
  ({ recordArea: 'SETUK', competency: 'ACADEMIC', text: 't', rationale: 'r', evidence: { quote: q, section: '세특' } });

describe('evidence', () => {
  it('모든 액션이 인용을 가지면 통과', () => {
    expect(assertCited([action('미적분 보고서')])).toBe(true);
  });
  it('빈 인용은 거부', () => {
    expect(() => assertCited([action('')])).toThrow();
  });
  it('불확실성 노트는 단정형이 아니다', () => {
    const note = buildUncertaintyNote();
    expect(note).not.toMatch(/합격(을|이)\s*보장|반드시 합격/);
    expect(note.length).toBeGreaterThan(10);
  });
});
