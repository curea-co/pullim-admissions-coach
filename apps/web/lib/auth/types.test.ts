import { describe, it, expect } from 'vitest';
import { isMinorByBirth, ageBandFromBirth } from './types';
describe('isMinorByBirth', () => {
  const today = new Date('2026-06-24');
  it('만 18세는 미성년', () => expect(isMinorByBirth('2008-01-01', today)).toBe(true));
  it('만 19세는 성인', () => expect(isMinorByBirth('2007-01-01', today)).toBe(false));
  it('생일 안 지난 만 19→18 경계', () => expect(isMinorByBirth('2007-12-31', today)).toBe(true));
});
describe('ageBandFromBirth', () => {
  const today = new Date('2026-06-24');
  it('만 16세(2010-01-01)는 over14', () => expect(ageBandFromBirth('2010-01-01', today)).toBe('over14'));
  it('만 11세(2015-01-01)는 under14', () => expect(ageBandFromBirth('2015-01-01', today)).toBe('under14'));
});
