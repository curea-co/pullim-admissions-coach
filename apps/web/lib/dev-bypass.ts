// 개발용 게이트 우회 — 실 auth 모드에서 입시코치 FE 게이트를 넘기는 개발 스위치 **두 종**.
//   ① `NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS` — 구매 벽만. 로그인은 한 상태에서 구매 벽 버튼으로 opt-in.
//   ② `NEXT_PUBLIC_DEV_GATE_BYPASS`        — 인증 + 구매 벽 둘 다. 토큰 없이 화면을 연다(클릭 없음).
// 둘 다 아래 **같은 호스트 allowlist**(isBypassableHost)를 마지막 잠금으로 쓴다.
//
// 왜 필요한가: dev 의 `GET /me/entitlements` 가 돌려주는 flags 에는 q·planner·writing·studio·
// reader·classbot·junior 7종뿐이고 `admissions` 키가 **아예 없다**(값이 0인 게 아니라 자리가 없다).
// 게이트 판정식은 `(ent.flags.admissions ?? 0) >= 1`(lib/admissions-api.ts) 이라 실 auth 모드에서는
// **어떤 계정도 통과하지 못한다.** 카탈로그 등록은 OS 소관이라 이 저장소에서 고칠 수 없고, 그 사이
// 같은 게이트를 쓰는 /submit·/consent·/processing 세 화면을 실 auth 모드로 확인할 방법이 없다.
//
// ⚠️ 한계(반드시 알고 쓸 것): 이 스위치는 **FE 게이트만** 넘는다. BE 는 `/admissions/*` 를
//    403 `{code:"FORBIDDEN"}` 으로 계속 막으므로 /processing 의 `POST /admissions/submissions` 는
//    여전히 실패한다. 화면 진입·레이아웃 확인까지만 되고, 실제 진단은 돌지 않는다.
//
// 안전장치는 **이중 잠금**이고 둘 다 만족해야 열린다:
//   1) 빌드 플래그 `NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS === 'true'`
//   2) 호스트 allowlist — 로컬 + dev 배포만. 운영(pullim.ai apex·admissions.pullim.ai)은 항상 거부.
// 2번이 핵심 방어선이다: 플래그가 실수로 운영 빌드에 켜진 채 배포돼도 운영 호스트에서는 열리지 않는다.
//
// 정직하게 적어 둔다: 플래그가 꺼진 빌드에서도 이 모듈과 호출부 JSX 는 번들에서 사라지지 않는다.
// `NEXT_PUBLIC_*` 는 빌드타임에 인라인되므로 `devBypassAvailable()` 첫 줄이 `'undefined' === 'true'`
// 로 평가돼 즉시 false 를 반환할 뿐이다. **코드가 없어서 안전한 게 아니라 두 잠금이 걸려서 안전하다.**

/**
 * 우회 상태 저장소 키. **sessionStorage** 를 쓰는 이유는 두 가지다.
 *  ① 탭을 닫으면 사라진다 — 켜 둔 채 잊고 다음 날 "왜 통과되지?" 하는 사고를 구조적으로 막는다.
 *  ② /submit → /consent → /processing 세 화면이 모두 같은 게이트를 쓰므로 라우트 이동에도 유지돼야
 *     한다. 컴포넌트 state 로 들고 있으면 이동할 때 날아가 매번 다시 켜야 한다.
 */
const STORAGE_KEY = 'admissions-dev-entitlement-bypass';

/**
 * 호스트 allowlist — 우회를 열어도 되는 호스트인지. 두 잠금 중 **운영을 지키는 쪽**이라
 * 순수 함수로 분리해 단독으로 테스트한다.
 * 허용: 로컬(localhost·127.0.0.1·[::1]·pullim.local·*.pullim.local) + dev 배포(`dev-`/`dev.` 접두
 * **이면서** `.pullim.ai`/`.pullim.local` 접미인 호스트).
 * 그 외는 전부 거부 — 운영(pullim.ai·admissions.pullim.ai·www.pullim.ai)과 우리 도메인이 아닌
 * `dev-*` 프리뷰 URL 포함.
 */
export function isBypassableHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return false;
  // IPv6 루프백은 브라우저의 location.hostname 에서 대괄호가 붙은 `[::1]` 로 온다(둘 다 받는다).
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') return true;
  if (h === 'pullim.local' || h.endsWith('.pullim.local')) return true;
  // dev 배포 표면 — **접두 + 풀림 도메인 접미를 동시에** 만족해야 한다.
  // 접두(`dev-`/`dev.`)만 보면 우리 소유가 아닌 호스트(프리뷰 URL: `dev-*.vercel.app` 등)에서도
  // 열린다. 접미를 함께 요구해 표면을 우리 도메인으로 묶는다.
  // 접두의 구분자(`-`·`.`)는 못박아 `devil.pullim.ai` 가 dev 로 새지 않게 하고(osTier() 와 같은 규칙),
  // 접미는 **점을 포함**해 `notpullim.ai` 류가 통과하지 않게 한다. apex `pullim.ai` 는 접두가 없어
  // 어차피 거부된다.
  const devPrefix = h.startsWith('dev-') || h.startsWith('dev.');
  const pullimDomain = h.endsWith('.pullim.ai') || h.endsWith('.pullim.local');
  if (devPrefix && pullimDomain) return true;
  return false;
}

/** ①의 우회 창구가 열려 있는가 = 빌드 플래그 + 브라우저 컨텍스트 + 호스트 allowlist. */
export function devBypassAvailable(): boolean {
  // env 는 **함수 안에서** 읽는다 — 모듈 상수로 굳히면 테스트의 vi.stubEnv 가 먹지 않는다
  // (lib/pullim-services.ts 와 같은 제약). 리터럴 접근이어야 빌드타임 인라인이 된다.
  if (process.env.NEXT_PUBLIC_DEV_ENTITLEMENT_BYPASS !== 'true') return false;
  // SSR 에서는 호스트를 알 수 없다 → 판단 불가는 닫는 쪽으로.
  if (typeof window === 'undefined') return false;
  return isBypassableHost(window.location.hostname);
}

/**
 * 현재 우회가 켜져 있는가. 창구가 닫혀 있으면(플래그 off·운영 호스트) 저장값이 남아 있어도
 * **항상 false** — 로컬에서 켜 둔 세션이 다른 환경으로 새지 않게 하는 게 이 순서의 목적이다.
 */
export function readDevBypass(): boolean {
  if (!devBypassAvailable()) return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // 프라이빗 모드 등으로 storage 가 막힌 브라우저 — 우회가 안 켜질 뿐이고 게이트는 정상 동작한다.
    // 둘 중 하나로 실패해야 한다면 "게이트가 살아 있는 쪽"이 안전하다.
    return false;
  }
}

/** 우회 켜기/끄기. 창구가 닫혀 있으면 아무것도 쓰지 않는다. */
export function writeDevBypass(on: boolean): void {
  if (!devBypassAvailable()) return;
  try {
    if (on) window.sessionStorage.setItem(STORAGE_KEY, '1');
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // read 와 같은 이유 — 저장에 실패하면 우회가 켜지지 않는다(게이트 유지 = 안전한 실패).
  }
}

/**
 * ② 개발용 **게이트 전체 우회** — 인증(RequireAuth)과 구매 벽(RequireAdmissionsAccess)을 **둘 다**
 * 넘긴다. ①과 다른 점은 두 가지다.
 *   - **인증까지 넘는다.** ①은 로그인 뒤에 나오는 구매 벽 안의 버튼이라, 토큰이 없으면 그 화면에
 *     닿기도 전에 RequireAuth 가 OS 로그인으로 보내 버린다. dev 배포를 로그인 없이 열어 보려면
 *     인증 게이트도 같이 열려야 한다.
 *   - **세션 opt-in 이 없다.** 누를 버튼이 안 나오는 상황을 푸는 스위치라 sessionStorage 토글을
 *     둘 자리가 없다. 대신 플래그를 **별도 이름**으로 분리해, 구매 벽만 열려던 환경이 인증까지
 *     통째로 열리는 일이 없게 했다(①을 켜도 이 함수는 false).
 *
 * ⚠️ 여는 건 **화면뿐**이다. user 는 계속 null 이고 BE 는 401/403 으로 막으므로 실제 제출·진단은
 *    실패한다. 레이아웃·폼 확인 용도로만 쓴다.
 */
export function devGateBypassEnabled(): boolean {
  // ①과 같은 이유로 env 는 함수 안에서 리터럴로 읽는다(빌드타임 인라인 + 테스트 stubEnv).
  if (process.env.NEXT_PUBLIC_DEV_GATE_BYPASS !== 'true') return false;
  // SSR 에서는 호스트를 알 수 없다 → 판단 불가는 닫는 쪽으로(소비처의 hydration 처리도 이에 맞춘다).
  if (typeof window === 'undefined') return false;
  // 운영을 지키는 마지막 잠금 — ①과 **같은 allowlist** 를 쓴다. 판정을 복제하면 한쪽만 고쳐지는
  // 사고가 나므로 운영 잠금은 이 저장소에서 오직 isBypassableHost 한 곳에만 있다.
  return isBypassableHost(window.location.hostname);
}
