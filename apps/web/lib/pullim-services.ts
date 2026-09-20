// 풀림 입시코치 — topbar '서비스 전환' 스위처용 서비스 카탈로그 + 핸드오프 URL 파생.
//
// 정본: pullim-writing-coach `app/lib/pullim-services.ts`(풀림 OS ServiceSwitcher/os-services.ts 이식본).
// 각 서비스는 OS 하위 경로가 아니라 **독립 서브도메인 앱**(q.pullim.ai·writing.pullim.ai …)이다.
// 티어는 **자기 origin이 아니라 `NEXT_PUBLIC_OS_URL`(OS origin)** 에서 뽑는다 — 앱별 핸드오프 env가
// 하나도 없어도 티어가 유지되는, OS에서 검증된 규칙이다. `NEXT_PUBLIC_*` 는 빌드타임 인라인이라
// 런타임 분기가 없다.
//
// ⚠️ env는 **반드시 함수 안에서** 읽는다(모듈 최상단 상수로 캐시 금지). 캐시하면 `vi.stubEnv` 가
//    먹지 않아 티어·override·안전장치를 테스트로 고정할 수 없다 — 테스트 가능성이 설계 제약이다.

import type { ServiceIconName } from '@/components/ui/service-icon';

/** OS origin 원값. 미설정이면 빈 문자열 — 아래 안전장치들의 단일 입력. */
function osUrl(): string {
  return process.env.NEXT_PUBLIC_OS_URL ?? '';
}

/**
 * 배포 티어를 OS origin에서 파생한다.
 *   `dev.pullim.ai`/`dev-os.pullim.ai` → dev · `pullim.ai`/`os.pullim.ai` → prod ·
 *   `localhost`/`*.pullim.local`/미설정 → local.
 *
 * ⚠️ **정본(writing-coach)의 `dev-` 접두 규칙을 `dev.` 까지 넓혔다. 정본으로 되돌리지 마라.**
 * 정본이 옳았던 건 형제 앱들이 OS 앵커로 `os.*` 서브도메인(`dev-os.pullim.ai`)을 쓰기 때문이다.
 * 우리는 **apex** 를 쓴다 — `os.*` 는 proxy가 전 경로를 OS 셸로 rewrite 해 `/login` 이 404라
 * 반드시 apex 여야 한다(.env.local.example · lib/auth/os-login.ts). 그리고 dev 표면의 apex 는
 * 하이픈이 아니라 점이다. 2026-09 DNS·HTTP 실측:
 *   - `dev-pullim.ai` → **DNS 없음**(존재하지 않는 호스트)
 *   - `dev.pullim.ai` → DNS OK, `https://dev.pullim.ai/login` 200(dev OS 로그인 페이지 실물)
 *   - `dev-admissions.pullim.ai` → DNS OK(우리 dev 배포)
 * 즉 접두 규칙만 두면 dev 배포의 `NEXT_PUBLIC_OS_URL=https://dev.pullim.ai` 가 prod로 오판돼
 * 스위처가 dev 사용자를 **운영 도메인**(`https://planner.pullim.ai` …)으로 내보낸다. 조용히 틀리는
 * 종류라 아래 `switcherServices()` 안전장치의 취지와 정면으로 어긋난다.
 *
 * 넓힌 건 **판정뿐이고 파생은 그대로** `dev-<app>.pullim.ai` 다(실측한 `dev-admissions.pullim.ai`
 * 형태와 일치). 형제 앱 표기 `dev-os.pullim.ai` 도 계속 dev로 남는 안전한 상위집합이다.
 * `dev.`/`dev-` 로 구분자를 못박으므로 `devil.pullim.ai` 같은 호스트는 dev로 새지 않는다.
 */
function osTier(): 'dev' | 'prod' | 'local' {
  const os = osUrl();
  if (!os || os.includes('localhost') || os.includes('.local')) return 'local';
  const host = os.replace(/^https?:\/\//, '');
  return host.startsWith('dev-') || host.startsWith('dev.') ? 'dev' : 'prod';
}

/**
 * 앱별 명시 origin override(OS `siblingAppUrl` 의 explicit 분기 정합). **최우선** — 있으면 티어 파생을 건너뛴다.
 * `.env.local` 에 로컬 앱 origin을 넣으면 서비스 전환이 그 로컬 앱으로 실제 위임된다
 * (형제 앱 Codex #135: 로컬에서 전 항목이 OS 허브 하나로 붕괴하지 않게 하는 유일한 경로).
 *
 * `NEXT_PUBLIC_*` 는 빌드타임 인라인이라 **리터럴 접근**이어야 한다 — `process.env[key]` 같은 동적
 * 조회는 번들에 치환되지 않아 항상 undefined가 된다. 그래서 정적 키의 맵으로 적는다.
 * 맵을 모듈 상수가 아니라 함수로 두는 이유는 위 파일 헤더 참고(테스트에서 stubEnv 가능해야 한다).
 */
function appOriginOverride(): Record<string, string | undefined> {
  return {
    planner: process.env.NEXT_PUBLIC_PLANNER_URL,
    q: process.env.NEXT_PUBLIC_Q_URL,
    writing: process.env.NEXT_PUBLIC_WRITING_URL,
    studio: process.env.NEXT_PUBLIC_STUDIO_URL,
    jr: process.env.NEXT_PUBLIC_JR_URL,
    arcade: process.env.NEXT_PUBLIC_ARCADE_URL,
    // 아래 3개는 현재 목록에서 숨김(맨 아래 노출 목록 주석 참고) — 복원 시 그대로 쓰려고 남겨 둔다.
    classbot: process.env.NEXT_PUBLIC_CLASSBOT_URL,
    games: process.env.NEXT_PUBLIC_GAMES_URL,
    store: process.env.NEXT_PUBLIC_STORE_URL,
  };
}

/**
 * OS 허브 URL — `NEXT_PUBLIC_OS_URL` 을 origin 으로 정규화한 값.
 *
 * 두 곳이 **같은 함수를 공유해야 한다**: (a) 스위처의 'OS 홈' 항목 목적지, (b) 로컬 티어에서
 * 형제 앱 링크가 위임되는 폴백(`appHref`). 규칙을 복제하면 두 곳이 어긋나도 타입은 통과하고
 * 테스트도 각자 통과한다 — dev 티어 판정처럼 이 규칙도 또 바뀔 텐데 그때 한쪽만 고쳐지면
 * OS 홈만 조용히 엉뚱한 곳을 가리킨다. 그래서 컴포넌트에 다시 구현하지 말고 이걸 쓴다.
 *
 * 정본(writing-coach `osHubUrl()`)은 `{OS}/os` 로 위임하지만, 이 저장소의 `NEXT_PUBLIC_OS_URL` 은
 * apex라 `/os` 를 덧붙이면 안 된다 — **origin만** 쓴다. 앱 path(`/planner` 등)도 붙이지 않는다:
 * 허브는 그 앱이 아니므로 하위 경로가 존재하지 않는다. 경로·쿼리가 붙은 값을 넣어도 origin 만 남는다.
 *
 * @returns OS 홈 origin. `NEXT_PUBLIC_OS_URL` 미설정이거나 형식 오류(스킴 누락 `'os.pullim.ai'` 등)면
 *   **`null`** — 호출부는 **'OS 홈' 항목만 숨기고 목록은 살린다**(user-menu 의 '설정' 항목과 동형).
 *   빈 문자열을 돌려주면 `href=""` 가 현재 페이지 리로드로 동작해 더 나쁘다.
 *   `lib/auth/os-login.ts` 와 같은 env를 읽지만 그 파일은 건드리지 않는다.
 */
export function osHubHref(): string | null {
  const raw = osUrl();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * 독립 앱 핸드오프 URL. 우선순위:
 *   1) 앱별 명시 override(`NEXT_PUBLIC_<APP>_URL`) — 로컬에서 서비스별 핸드오프 검증에 쓴다.
 *   2) dev 표면 → `https://dev-<app>.pullim.ai` · prod 표면 → `https://<app>.pullim.ai` (+path).
 *   3) override 없는 **로컬**은 실서비스 도메인으로 새지 않게 OS 허브로 위임 — 로컬 SSO 검증 중
 *      운영 도메인으로 튀어 쿠키/세션 조건이 달라지는 회귀(형제 앱 Codex #135) 차단. path 미부착.
 */
function appHref(app: string, path = ''): string {
  const override = appOriginOverride()[app];
  if (override) return `${override.replace(/\/$/, '')}${path}`;
  const tier = osTier();
  if (tier === 'local') {
    // 정규화는 `osHubHref()` 하나만 쓴다(규칙 복제 금지 — 위 주석). 다만 `href` 는 string 이어야 해서
    // null 을 그대로 흘릴 수 없다: 형식 오류 값이 로컬 티어로 잡히는 경우(`'os.pullim.local:3001'`
    // 처럼 스킴 누락)만 끝 슬래시를 뗀 원값으로 떨어진다. 갈라지는 건 이 마지막 한 칸뿐이고,
    // 'OS 홈' 은 항목째 숨기면 되지만 형제 앱 항목은 목록 구조상 자리를 비울 수 없어서 생기는 차이다.
    return osHubHref() ?? osUrl().replace(/\/$/, '');
  }
  const base = tier === 'dev' ? `https://dev-${app}.pullim.ai` : `https://${app}.pullim.ai`;
  return `${base}${path}`;
}

export type SwitcherService = {
  slug: string;
  name: string;
  /** 인라인 SVG 글리프 이름(`ServiceIcon`) — 아이콘 파일·next/image 불필요 */
  icon: ServiceIconName;
  href: string;
  /** 태그라인(OS os-services 정합) */
  desc: string;
};

/** 현재 서비스 slug — 스위처가 강조(현재 위치) 표시에 쓴다. */
export const CURRENT_SLUG = 'exam';

/**
 * 스위처에 노출할 서비스 목록.
 *
 * ⚠️ **`NEXT_PUBLIC_OS_URL` 미설정이면 빈 배열을 반환한다.** 티어 앵커가 없으면 어느 표면의 형제
 * 앱인지 알 수 없고, 그 상태로 링크를 그리면 전부 죽은 링크가 된다. 빈 배열은 호출부더러
 * **스위처를 통째로 렌더하지 말라**는 신호다 — 설정 오류를 prod 링크로 가리지 않는다.
 * (현재 서비스인 입시 코치 항목도 함께 빠진다: 목록이 자기 자신 하나뿐인 스위처는 의미가 없다.)
 *
 * 노출 목록(사용자 확정) — 개통된 서비스만: 플래너·문제큐·라이팅 코치·스튜디오·주니어·아케이드
 * + 현재 서비스인 입시 코치. **숨김(완전 비노출)**: 클래스봇·게임즈·스토어 — '준비 중' 배지가
 * 아니라 목록에서 제외한다. 개통·노출 결정 시 아래 항목을 되살린다(이름·설명은 OS os-services.ts 정본):
 *   { slug: 'classbot', name: '클래스봇', icon: 'classbot', href: appHref('classbot'), desc: … }
 *   { slug: 'games',    name: '게임즈',   icon: 'games',    href: appHref('games', '/games'), desc: … }
 *   { slug: 'store',    name: '스토어',   icon: 'store',    href: appHref('store'), desc: … }
 * (override 키는 복원이 쉽도록 이미 유지돼 있다. 다만 `ServiceIcon` 은 이 카탈로그가 실제로 쓰는
 *  글리프만 담고 있으므로, classbot·store 를 되살릴 땐 정본 writing-coach `service-icon.tsx` 에서
 *  해당 글리프를 함께 가져와야 한다 — `games` 글리프는 아케이드가 이미 쓰고 있어 그대로 쓸 수 있다.)
 */
export function switcherServices(): SwitcherService[] {
  if (!osUrl()) return [];
  return [
    { slug: 'planner', name: '플래너', icon: 'planner', href: appHref('planner', '/planner'), desc: '내 공부, 내가 설계한다.' },
    { slug: 'q', name: '문제큐', icon: 'q', href: appHref('q'), desc: '풀고, 틀리고, 다시 자라난다.' },
    { slug: 'writing', name: '라이팅 코치', icon: 'writing', href: appHref('writing'), desc: '한 줄, 한 단락이 더 좋아진다.' },
    { slug: 'studio', name: '스튜디오', icon: 'studio', href: appHref('studio'), desc: '제작은 AI가, 검증은 사람이.' },
    { slug: 'junior', name: '주니어', icon: 'junior', href: appHref('jr'), desc: '초등, 즐겁게 시작하는 첫 학습.' },
    { slug: 'arcade', name: '아케이드', icon: 'games', href: appHref('arcade'), desc: '무료로 즐기는 학습 아케이드.' },
    // 현재 서비스 — 외부 핸드오프가 아니라 자기 앱 루트. 태그라인은 정의 §6 가드레일 준수:
    //   '합격'·'정답'·'대본' 류 금지, 진단·준비 톤만(§6.1 생기부 진단 / §6.2 면접 준비).
    { slug: CURRENT_SLUG, name: '입시 코치', icon: 'exam', href: '/', desc: '생기부를 진단하고, 면접을 준비한다.' },
  ];
}
