import { describe, it, expect } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('내부 경로는 통과', () => {
    expect(safeNext('/mypage', '/x')).toBe('/mypage');
    expect(safeNext('/submit?a=1&b=2', '/x')).toBe('/submit?a=1&b=2');
  });
  it('null/빈값은 기본값', () => {
    expect(safeNext(null, '/home')).toBe('/home');
    expect(safeNext('', '/home')).toBe('/home');
    expect(safeNext(undefined, '/home')).toBe('/home');
  });
  it('절대 URL 차단', () => {
    expect(safeNext('https://evil.com', '/x')).toBe('/x');
    expect(safeNext('http://evil.com', '/x')).toBe('/x');
  });
  it('프로토콜-상대(//)·백슬래시 우회 차단', () => {
    expect(safeNext('//evil.com', '/x')).toBe('/x');
    expect(safeNext('/\\evil.com', '/x')).toBe('/x');
  });
  it('비-슬래시 시작 차단', () => {
    expect(safeNext('mypage', '/x')).toBe('/x');
    expect(safeNext('javascript:alert(1)', '/x')).toBe('/x');
  });
});
