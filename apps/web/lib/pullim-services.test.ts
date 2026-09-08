import { describe, it, expect, afterEach, vi } from 'vitest';
import { switcherServices, osHubHref, CURRENT_SLUG, type SwitcherService } from './pullim-services';

// env 는 함수 안에서 읽히므로 stubEnv 로 티어를 갈아끼울 수 있다(모듈 상수 캐시 금지가 설계 제약).
afterEach(() => vi.unstubAllEnvs());

function href(list: SwitcherService[], slug: string): string {
  const found = list.find((s) => s.slug === slug);
  if (!found) throw new Error(`목록에 ${slug} 항목이 없다`);
  return found.href;
}

describe('switcherServices — 티어 파생(NEXT_PUBLIC_OS_URL 앵커)', () => {
  // ⚠️ 우리 dev 배포의 실제 OS 앵커는 **apex + 점**(`https://dev.pullim.ai`)이다.
  //    `dev-pullim.ai` 는 DNS 자체가 없고, `/login` 200 인 dev 로그인 페이지는 `dev.pullim.ai` 에 있다
  //    (2026-09 실측). 정본의 `dev-` 접두 규칙만 두면 이 값이 prod 로 오판돼 dev 사용자가 운영
  //    도메인으로 나간다 — 아래 두 케이스가 그 회귀를 막는 잠금장치다.
  it('dev OS URL(apex, 점) → dev- 접두 형제 서브도메인 · 운영 도메인 미노출', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://dev.pullim.ai');
    const list = switcherServices();
    expect(href(list, 'planner')).toBe('https://dev-planner.pullim.ai/planner');
    expect(href(list, 'q')).toBe('https://dev-q.pullim.ai');
    expect(href(list, 'junior')).toBe('https://dev-jr.pullim.ai');

    // 판정이 prod 로 새면 여기서 걸린다: 접두 없는 운영 호스트가 하나도 나오면 안 된다.
    expect(href(list, 'planner')).not.toBe('https://planner.pullim.ai/planner');
    for (const svc of list) {
      expect(svc.href).not.toMatch(/^https:\/\/(?!dev-)[a-z]+\.pullim\.ai/);
    }
  });

  it('dev OS URL(형제 앱 표기 dev-os) → 여전히 dev(정본 케이스 회귀)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://dev-os.pullim.ai');
    const list = switcherServices();
    expect(href(list, 'planner')).toBe('https://dev-planner.pullim.ai/planner');
    expect(href(list, 'q')).toBe('https://dev-q.pullim.ai');
    expect(href(list, 'writing')).toBe('https://dev-writing.pullim.ai');
    expect(href(list, 'studio')).toBe('https://dev-studio.pullim.ai');
    // 주니어의 앱 slug 는 'jr'(표시명만 '주니어') — 서브도메인도 jr 다.
    expect(href(list, 'junior')).toBe('https://dev-jr.pullim.ai');
    expect(href(list, 'arcade')).toBe('https://dev-arcade.pullim.ai');
  });

  it('prod OS URL(apex) → 접두 없는 형제 서브도메인', () => {
    // 이 저장소의 OS_URL 은 apex(https://pullim.ai) — os.* 는 proxy rewrite 로 /login 404.
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    const list = switcherServices();
    expect(href(list, 'planner')).toBe('https://planner.pullim.ai/planner');
    expect(href(list, 'q')).toBe('https://q.pullim.ai');
    expect(href(list, 'junior')).toBe('https://jr.pullim.ai');

    // dev 판정을 `dev.` 까지 넓혔다고 apex prod 를 잘못 먹으면 안 된다 — 양방향 회귀 잠금.
    for (const svc of list) {
      expect(svc.href).not.toContain('dev-');
    }
  });

  it('prod OS URL 이 os.* 서브도메인이어도 동일하게 prod 로 잡힌다', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://os.pullim.ai');
    expect(href(switcherServices(), 'planner')).toBe('https://planner.pullim.ai/planner');
  });

  it('dev 로 시작하지만 구분자가 아닌 호스트(devil.pullim.ai)는 dev 가 아니다', () => {
    // 판정은 `dev-`/`dev.` 로 구분자를 못박는다 — 접두 문자열만 보면 여기서 샌다.
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://devil.pullim.ai');
    expect(href(switcherServices(), 'planner')).toBe('https://planner.pullim.ai/planner');
  });
});

describe('switcherServices — 로컬 안전장치', () => {
  // override 없는 로컬에서 실서비스 도메인으로 새면 로컬 SSO 검증 중 쿠키/세션 조건이 달라진다
  // (형제 앱 Codex #135). 전 항목을 OS 허브로 위임하고 .pullim.ai 는 한 개도 만들지 않는다.
  it.each([
    ['http://os.pullim.local:3001', 'http://os.pullim.local:3001'],
    ['http://localhost:3001', 'http://localhost:3001'],
  ])('%s → 전 항목이 OS 허브로 위임되고 .pullim.ai 가 없다', (osUrl, hub) => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', osUrl);
    const list = switcherServices();

    for (const svc of list) {
      expect(svc.href).not.toContain('.pullim.ai');
    }
    for (const slug of ['planner', 'q', 'writing', 'studio', 'junior', 'arcade']) {
      // path 미부착 — 허브는 그 앱이 아니므로 /planner 같은 하위 경로가 없다.
      expect(href(list, slug)).toBe(hub);
    }
    // 현재 서비스만 예외: 외부 핸드오프가 아니라 자기 앱 루트다.
    expect(href(list, CURRENT_SLUG)).toBe('/');
  });

  it('끝 슬래시·경로가 붙은 로컬 OS URL 도 origin 으로 정규화된다', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'http://pullim.local:3001/os/');
    expect(href(switcherServices(), 'planner')).toBe('http://pullim.local:3001');
  });
});

describe('switcherServices — 앱별 override 최우선', () => {
  it('NEXT_PUBLIC_PLANNER_URL 이 티어 파생을 이긴다(prod 티어에서도)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    vi.stubEnv('NEXT_PUBLIC_PLANNER_URL', 'http://localhost:3002');
    const list = switcherServices();
    expect(href(list, 'planner')).toBe('http://localhost:3002/planner');
    // override 없는 다른 항목은 티어 파생 그대로 — override 는 앱 단위다.
    expect(href(list, 'q')).toBe('https://q.pullim.ai');
  });

  it('override 끝 슬래시는 제거하고 path 를 붙인다', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    vi.stubEnv('NEXT_PUBLIC_PLANNER_URL', 'http://localhost:3002/');
    expect(href(switcherServices(), 'planner')).toBe('http://localhost:3002/planner');
  });

  it('로컬 티어에서도 override 가 허브 위임보다 우선(로컬 서비스별 핸드오프 검증 경로)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'http://pullim.local:3001');
    vi.stubEnv('NEXT_PUBLIC_PLANNER_URL', 'http://planner.pullim.local:3002');
    expect(href(switcherServices(), 'planner')).toBe('http://planner.pullim.local:3002/planner');
  });
});

describe('switcherServices — 미설정 안전장치', () => {
  it('NEXT_PUBLIC_OS_URL 미설정 → 빈 배열(호출부가 스위처를 통째로 숨긴다)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', '');
    expect(switcherServices()).toEqual([]);
  });
});

describe('switcherServices — 노출 목록', () => {
  it('현재 서비스(입시 코치)가 목록에 있고 자기 앱 루트를 가리킨다', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    const exam = switcherServices().find((s) => s.slug === CURRENT_SLUG);
    expect(CURRENT_SLUG).toBe('exam');
    expect(exam).toBeDefined();
    expect(exam!.href).toBe('/');
    expect(exam!.icon).toBe('exam');
  });

  it('숨김 서비스(클래스봇·게임즈·스토어)는 목록에 없다', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    const slugs = switcherServices().map((s) => s.slug);
    expect(slugs).not.toContain('classbot');
    expect(slugs).not.toContain('games');
    expect(slugs).not.toContain('store');
  });

  it('확정된 7개 항목이 순서대로 노출된다', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    expect(switcherServices().map((s) => s.slug)).toEqual([
      'planner', 'q', 'writing', 'studio', 'junior', 'arcade', 'exam',
    ]);
  });

  it('아케이드는 games 글리프를 재사용한다(전용 마크 없음)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    expect(switcherServices().find((s) => s.slug === 'arcade')!.icon).toBe('games');
  });

  it('모든 항목이 이름·태그라인을 갖는다(빈 문자열 금지)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    for (const svc of switcherServices()) {
      expect(svc.name.length).toBeGreaterThan(0);
      expect(svc.desc.length).toBeGreaterThan(0);
    }
  });

  it('입시 코치 태그라인이 §6 가드레일 금칙어를 쓰지 않는다', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    const desc = switcherServices().find((s) => s.slug === CURRENT_SLUG)!.desc;
    for (const banned of ['합격', '정답', '대본']) {
      expect(desc).not.toContain(banned);
    }
  });
});

describe('osHubHref — OS 홈 목적지(스위처 OS 홈 항목 + 로컬 폴백 공용)', () => {
  it('prod apex → origin 그대로', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai');
    expect(osHubHref()).toBe('https://pullim.ai');
  });

  it('dev apex → origin 그대로(형제 앱처럼 dev- 로 파생하지 않는다 — 허브는 OS 자신)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://dev.pullim.ai');
    expect(osHubHref()).toBe('https://dev.pullim.ai');
  });

  it('로컬 → 스킴·포트 보존', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'http://pullim.local:3001');
    expect(osHubHref()).toBe('http://pullim.local:3001');
  });

  it('경로·끝 슬래시가 붙어 있어도 origin 만 남는다', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai/os/');
    expect(osHubHref()).toBe('https://pullim.ai');
  });

  it('NEXT_PUBLIC_OS_URL 미설정 → null(호출부가 OS 홈 항목만 숨긴다)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', '');
    expect(osHubHref()).toBeNull();
  });

  it('형식 오류(스킴 누락) → null — 빈 문자열이면 href="" 가 현재 페이지 리로드가 된다', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'os.pullim.ai');
    expect(osHubHref()).toBeNull();
  });

  it('로컬 티어 형제 앱 폴백이 osHubHref() 와 같은 값을 쓴다(규칙 복제 방지 잠금)', () => {
    // 두 소비처가 갈라지면 여기서 걸린다 — 어긋나도 타입은 통과하는 종류라 값으로 묶어 둔다.
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'http://pullim.local:3001/os/');
    const hub = osHubHref();
    expect(hub).toBe('http://pullim.local:3001');
    for (const slug of ['planner', 'q', 'writing', 'studio', 'junior', 'arcade']) {
      expect(href(switcherServices(), slug)).toBe(hub);
    }
  });
});
