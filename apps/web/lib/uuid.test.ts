import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeRandomUUID } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('safeRandomUUID', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('네이티브 crypto.randomUUID 사용 시 유효한 v4', () => {
    expect(safeRandomUUID()).toMatch(V4);
  });

  it('비보안 컨텍스트(randomUUID 없음)도 getRandomValues 폴백으로 유효한 v4 — throw 안 함', () => {
    vi.stubGlobal('crypto', {
      // randomUUID 미정의(= os.pullim.local HTTP 재현). getRandomValues만 제공.
      getRandomValues: (a: Uint8Array) => {
        for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 0xff;
        return a;
      },
    });
    const id = safeRandomUUID();
    expect(id).toMatch(V4); // version=4, variant 비트 보정 확인
  });

  it('연속 호출은 서로 다르다(네이티브)', () => {
    expect(safeRandomUUID()).not.toBe(safeRandomUUID());
  });
});
