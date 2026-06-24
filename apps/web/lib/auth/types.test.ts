import { describe, it, expect } from 'vitest';
import { isMinorByBirth } from './types';
describe('isMinorByBirth', () => {
  const today = new Date('2026-06-24');
  it('만 18세는 미성년', () => expect(isMinorByBirth('2008-01-01', today)).toBe(true));
  it('만 19세는 성인', () => expect(isMinorByBirth('2007-01-01', today)).toBe(false));
  it('생일 안 지난 만 19→18 경계', () => expect(isMinorByBirth('2007-12-31', today)).toBe(true));
});
