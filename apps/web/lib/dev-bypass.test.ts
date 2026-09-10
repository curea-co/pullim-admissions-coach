import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isBypassableHost, devBypassAvailable, readDevBypass, writeDevBypass } from './dev-bypass';

// 개발용 엔타이틀먼트 우회의 **이중 잠금**(빌드 플래그 + 호스트 allowlist) 회귀 고정.
// 가장 중요한 단언은 "플래그가 켜져도 운영 호스트에서는 열리지 않는다" — 플래그가 실수로 운영
// 빌드에 들어가는 사고를 이 잠금 하나로 막기 때문에, 이 테스트가 깨지면 방어선이 사라진 것이다.
// env 는 dev-bypass.ts 가 함수 안에서 읽으므로 stubEnv 로 갈아끼울 수 있다(모듈 상수 캐시 금지).

const KEY = 'admissions-dev-entitlement-bypass';

/** jsdom 의 location 은 hostname 을 바꿀 수 없어 통째로 교체한다(lib/user-menu.test.tsx 패턴). */
function setHost(hostname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname, origin: `https://${hostname}`, href: `https://${hostname}/` },
  });
}

const ssDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
function stubSessionStorage(impl: Partial<Storage>) {
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: impl });
}
function restoreSessionStorage() {
  if (ssDescriptor) Object.defineProperty(window, 'sessionStorage', ssDescriptor);
  else delete (window as unknown as Record<string, unknown>).sessionStorage;
}

beforeEach(() => {
  setHost('localhost');
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  restoreSessionStorage();
});

describe('isBypassableHost — 호스트 allowlist(운영 잠금)', () => {
  it.each(['localhost', '127.0.0.1', '::1', '[::1]', 'pullim.local', 'admissions.pullim.local'])(
    '로컬 호스트 %s 는 허용',
    (h) => expect(isBypassableHost(h)).toBe(true),
  );

  it.each(['dev.pullim.ai', 'dev-admissions.pullim.ai', 'dev-os.pullim.ai'])(
    'dev 배포 호스트 %s 는 허용',
    (h) => expect(isBypassableHost(h)).toBe(true),
  );

  it.each(['pullim.ai', 'admissions.pullim.ai', 'www.pullim.ai', 'os.pullim.ai'])(
    '운영 호스트 %s 는 거부',
    (h) => expect(isBypassableHost(h)).toBe(false),
  );

  it.each(['dev-foo.pullim.local', 'dev.pullim.local'])(
    'dev 접두 + 풀림 로컬 도메인 %s 도 허용',
    (h) => expect(isBypassableHost(h)).toBe(true),
  );

  it('`dev` 로 시작하지만 구분자가 없는 호스트는 dev 로 새지 않는다', () => {
    expect(isBypassableHost('devil.pullim.ai')).toBe(false);
    expect(isBypassableHost('development.pullim.ai')).toBe(false);
  });

  // 접두만으로는 부족하다 — 우리 소유가 아닌 프리뷰 URL 표면이 그대로 열린다.
  it.each([
    'dev-preview.vercel.app',
    'dev-foo.example.com',
    'dev-foo.pullim.ai.evil.com',
    'dev-foo.notpullim.ai',
    'dev.notpullim.local',
  ])('dev 접두여도 풀림 도메인이 아니면 %s 는 거부', (h) =>
    expect(isBypassableHost(h)).toBe(false),
  );

  it('대소문자·공백은 정규화하고, 빈 문자열은 거부', () => {
    expect(isBypassableHost(' LocalHost ')).toBe(true);
    expect(isBypassableHost('DEV.pullim.ai')).toBe(true);
    expect(isBypassableHost('')).toBe(false);
  });

  it('pullim.local 을 접미로 흉내 낸 호스트는 거부(경계는 점으로 못박는다)', () => {
    expect(isBypassableHost('evilpullim.local')).toBe(false);
  });
});

describe('devBypassAvailable — 플래그 × 호스트', () => {
  it('플래그 미설정이면 로컬에서도 false', () => {
    expect(devBypassAvailable()).toBe(false);
  });

  it("플래그가 'true' 가 아닌 값('1')이면 false", () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', '1');
    expect(devBypassAvailable()).toBe(false);
  });

  it.each(['localhost', '127.0.0.1', 'admissions.pullim.local', 'dev-admissions.pullim.ai', 'dev.pullim.ai'])(
    '플래그 on + %s → true',
    (h) => {
      vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', 'true');
      setHost(h);
      expect(devBypassAvailable()).toBe(true);
    },
  );

  it.each(['pullim.ai', 'admissions.pullim.ai', 'www.pullim.ai'])(
    '플래그가 실수로 켜진 운영 빌드여도 %s 에서는 false — 이게 마지막 잠금이다',
    (h) => {
      vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', 'true');
      setHost(h);
      expect(devBypassAvailable()).toBe(false);
    },
  );
});

describe('readDevBypass / writeDevBypass', () => {
  it('창구가 열린 상태에서 write → read 왕복', () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', 'true');
    writeDevBypass(true);
    expect(window.sessionStorage.getItem(KEY)).toBe('1');
    expect(readDevBypass()).toBe(true);
    writeDevBypass(false);
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(readDevBypass()).toBe(false);
  });

  it('창구가 닫혀 있으면(플래그 off) 저장값이 남아 있어도 false', () => {
    window.sessionStorage.setItem(KEY, '1');
    expect(readDevBypass()).toBe(false);
  });

  it('창구가 닫혀 있으면(운영 호스트) 저장값이 남아 있어도 false', () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', 'true');
    window.sessionStorage.setItem(KEY, '1');
    setHost('admissions.pullim.ai');
    expect(readDevBypass()).toBe(false);
  });

  it('창구가 닫혀 있으면 write 는 아무것도 쓰지 않는다', () => {
    writeDevBypass(true);
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('sessionStorage 가 throw 해도(프라이빗 모드) 터지지 않고 false — 게이트가 살아 있는 쪽으로 실패', () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS', 'true');
    const blocked = () => {
      throw new Error('SecurityError: storage blocked');
    };
    stubSessionStorage({ getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => writeDevBypass(true)).not.toThrow();
    expect(() => writeDevBypass(false)).not.toThrow();
    expect(readDevBypass()).toBe(false);
  });
});
