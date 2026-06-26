import { describe, it, expect } from 'vitest';
import { createMemoryRateLimiter } from './memory-adapter';
import type { RateLimitRule } from './types';

// 주입식 클록으로 시간 흐름을 결정론적으로 제어한다.
function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

const BURST: RateLimitRule[] = [{ windowSec: 60, max: 3 }];
const TIERED: RateLimitRule[] = [
  { windowSec: 60, max: 3 },
  { windowSec: 86_400, max: 10 },
];

describe('createMemoryRateLimiter', () => {
  it('윈도우 내 max까지 허용, 초과 시 차단', async () => {
    const c = clock();
    const rl = createMemoryRateLimiter({ now: c.now });
    expect((await rl.check('ip', BURST)).allowed).toBe(true);
    expect((await rl.check('ip', BURST)).allowed).toBe(true);
    expect((await rl.check('ip', BURST)).allowed).toBe(true);
    const blocked = await rl.check('ip', BURST);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('윈도우가 지나면 다시 허용', async () => {
    const c = clock();
    const rl = createMemoryRateLimiter({ now: c.now });
    for (let i = 0; i < 3; i++) await rl.check('ip', BURST);
    expect((await rl.check('ip', BURST)).allowed).toBe(false);
    c.advance(60_001); // 60초 + 1ms
    expect((await rl.check('ip', BURST)).allowed).toBe(true);
  });

  it('차단된 호출은 윈도우를 더 늘리지 않는다(기록 안 함)', async () => {
    const c = clock();
    const rl = createMemoryRateLimiter({ now: c.now });
    for (let i = 0; i < 3; i++) await rl.check('ip', BURST); // t=start, 가장 오래된 = start
    // 30초 시점에 차단 시도 여러 번 — 기록되면 안 됨
    c.advance(30_000);
    for (let i = 0; i < 5; i++) expect((await rl.check('ip', BURST)).allowed).toBe(false);
    // 최초 3건의 가장 오래된 것이 60초에 만료 → 60.001초에 1건 허용되어야
    c.advance(30_001); // 누적 60.001초
    expect((await rl.check('ip', BURST)).allowed).toBe(true);
  });

  it('key(IP)별로 독립 카운트', async () => {
    const c = clock();
    const rl = createMemoryRateLimiter({ now: c.now });
    for (let i = 0; i < 3; i++) await rl.check('ip-a', BURST);
    expect((await rl.check('ip-a', BURST)).allowed).toBe(false);
    expect((await rl.check('ip-b', BURST)).allowed).toBe(true); // 다른 IP는 영향 없음
  });

  it('다단계 규칙: 버스트는 풀려도 일일 캡으로 차단', async () => {
    const c = clock();
    const rl = createMemoryRateLimiter({ now: c.now });
    let allowed = 0;
    // 분당 3 → 매 분 3건씩, 일일 캡 10에 걸릴 때까지
    for (let minute = 0; minute < 5; minute++) {
      for (let i = 0; i < 3; i++) {
        if ((await rl.check('ip', TIERED)).allowed) allowed++;
      }
      c.advance(61_000); // 다음 분(버스트 윈도우 리셋)
    }
    expect(allowed).toBe(10); // 일일 캡에서 멈춤
    expect((await rl.check('ip', TIERED)).allowed).toBe(false);
  });

  it('remaining: 허용 시 가장 빡빡한 규칙 기준 잔여', async () => {
    const c = clock();
    const rl = createMemoryRateLimiter({ now: c.now });
    const first = await rl.check('ip', BURST); // max 3 → 1건 사용 후 잔여 2
    expect(first.remaining).toBe(2);
    expect(first.limit).toBe(3);
  });

  it('maxKeys 초과 시 가장 오래된 key evict(메모리 상한)', async () => {
    const c = clock();
    const rl = createMemoryRateLimiter({ now: c.now, maxKeys: 2 });
    await rl.check('k1', BURST);
    await rl.check('k2', BURST);
    await rl.check('k3', BURST); // k1 evict
    // k1은 evict되어 카운트가 리셋 → 다시 3건 모두 허용
    expect((await rl.check('k1', BURST)).allowed).toBe(true);
  });
});
