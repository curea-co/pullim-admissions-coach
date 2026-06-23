import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findUnreflectedRecommendations } from './unreflected-activities';

const CASES = [
  'case-01-park-junho.md',
  'case-02-kim-seoyeon.md',
  'case-03-lee-doyun.md',
  'case-04-choi-haeun.md',
  'case-05-park-minjun.md',
];

// 출력③ 섹션만 추출(헤더 '기대 출력 ③' ~ 다음 '## ' 전까지).
function output3(md: string): string {
  const start = md.indexOf('기대 출력 ③');
  if (start === -1) return '';
  const rest = md.slice(start);
  const next = rest.indexOf('\n## ', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('golden 출력③ — 미반영 항목 신설 추천 0건 (#20 회귀)', () => {
  for (const f of CASES) {
    it(f, () => {
      const md = readFileSync(
        fileURLToPath(new URL(`../../../../docs/golden/${f}`, import.meta.url)),
        'utf8'
      );
      const body = output3(md);
      expect(body.trim().length).toBeGreaterThan(0); // 출력③ 섹션 실제 추출 보장(가짜 통과 방지)
      expect(findUnreflectedRecommendations(body)).toEqual([]);
    });
  }
});
