'use client';

// topbar '서비스 전환' 스위처 — 브랜드 마스트 바로 오른쪽(풀림 OS `OsShell` 순서)에 놓이는 **자립형**.
// 통합 담당이 DashboardShell 의 `switcher` 슬롯에 <ServiceSwitcher /> 하나만 꽂으면 된다.
//
// 이 앱에는 서비스 카탈로그 기능이 없지만 스위처는 성립한다 — 스위처는 이 앱의 기능이 아니라
// **다른 서비스로 나가는 장치**이고, 형제 앱 3곳(Q·플래너·라이팅 코치)이 전부 갖고 있다.
//
// 이식 정본: pullim-writing-coach `app/components/service-switcher.tsx`
//   (Radix·lucide 없이 자립 구현한 유일한 형제 앱 = 이 앱의 의존성 프로필과 동일).
//   다만 두 가지는 정본을 그대로 옮기지 않았다:
//     1) 드롭다운 상태 관리 — 정본의 자체 useEffect 대신 이 저장소의 `useDropdown` 훅을 쓴다.
//        바깥 클릭·Esc·포커스 복귀·트리거 재클릭은 프로필 메뉴가 Codex #70 3~5차까지 가며
//        다듬은 경로다. 직접 다시 구현하면 그 회귀를 그대로 재현한다.
//     2) 색 — 정본은 토큰이 없어 hex 를 하드코딩했지만 여기엔 PUDS 시맨틱 토큰이 있다.
//        패널 chrome(테두리·배경·그림자·라운드)은 프로필 메뉴(components/auth/user-menu.tsx)와
//        같은 토큰으로 맞춰 두 드롭다운이 한 벌로 보이게 한다.
//
// 의존성 원칙: Radix·lucide 없음 — 셰브론은 인라인 SVG, 서비스 마크는 `ServiceIcon`(인라인 SVG).

import type { Route } from 'next';
import Link from 'next/link';
import { useId } from 'react';
import { ServiceIcon } from '@/components/ui/service-icon';
import {
  CURRENT_SLUG,
  osHubHref,
  switcherServices,
  type SwitcherService,
} from '@/lib/pullim-services';
import { useDropdown } from '@/lib/use-dropdown';
import { cn } from '@/lib/utils';

/** 목록 항목 공통 — 아이콘 34px + (이름 + 태그라인) 2행. */
const ITEM_CLASS =
  'flex items-center gap-3 rounded-[var(--radius-md)] p-2.5 no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]';

export function ServiceSwitcher() {
  // `nav` + 링크 목록이라 항목 선택자를 주입한다(훅 기본값은 `[role="menuitem"]`).
  const { open, close, rootProps, triggerProps, menuProps } = useDropdown({
    itemSelector: 'a[data-dropdown-item]',
  });
  const menuId = useId();

  const services = switcherServices();
  const current = services.find((s) => s.slug === CURRENT_SLUG);
  // OS 홈 목적지는 **카탈로그가 소유한다**. 같은 값을 로컬 티어의 형제 앱 폴백(`appHref`)도 쓰기
  // 때문에, 여기서 규칙을 다시 구현하면 정규화 규칙이 바뀔 때 한쪽만 고쳐져 OS 홈만 조용히
  // 엉뚱한 곳을 가리키게 된다. null = 미설정·형식 오류 → 아래에서 항목째 숨긴다.
  const homeHref = osHubHref();

  // 카탈로그 계약: 빈 배열 = `NEXT_PUBLIC_OS_URL` 미설정 = 티어 앵커 없음.
  // 어느 표면의 형제 앱인지 모르는 상태로 링크를 그리면 전부 죽은 링크가 되므로 **통째로 렌더하지
  // 않는다**(설정 오류를 prod 링크로 가리지 않는다). 현재 서비스 항목도 함께 빠지므로
  // '자기 자신 하나뿐인 드롭다운'이 생길 여지도 없다. — lib/pullim-services.ts `switcherServices()` 주석
  if (services.length === 0) return null;

  return (
    <div {...rootProps} className="relative ml-0.5 flex items-center">
      {/* 트리거 = OS `.switcher-trigger` 정합 pill: 아이콘 26px + 현재 서비스명 + 셰브론. */}
      <button
        {...triggerProps}
        type="button"
        // `aria-haspopup` 을 붙이지 않는다 — 값 "true" 는 ARIA 상 "menu" 와 동의어라, 아래를 nav 로
        // 둔 판단과 어긋나게 "메뉴 있음"으로 낭독된다. 여는 대상이 메뉴가 아니라 링크 목록이므로
        // disclosure 패턴 그대로 `aria-expanded` + `aria-controls` 만 쓴다.
        aria-controls={open ? menuId : undefined}
        aria-label="서비스 전환"
        title="서비스 전환"
        className="flex h-[38px] items-center gap-1.5 rounded-[11px] border border-[var(--border-default)] bg-[var(--surface-raised)] pl-1.5 pr-2 text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2"
      >
        <span className="flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-[var(--radius-sm)]">
          <ServiceIcon name={current?.icon ?? 'pullim'} size={26} aria-hidden />
        </span>
        {/* 현재 서비스명 — 초협폭(<380px)에서는 숨긴다. 브랜드 서브라벨(min-[561px])과 같은 규칙으로,
            우측 액션(검색·알림·프로필)이 수평으로 밀려나는 걸 막는다(pullim-writing-coach #125 전례).
            트리거 자체의 접근명은 aria-label 이 항상 들고 있어 이름이 사라져도 낭독은 유지된다. */}
        <span className="hidden whitespace-nowrap text-[13px] font-bold tracking-[-0.02em] text-[var(--text-primary)] min-[380px]:inline">
          {current?.name ?? '서비스'}
        </span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn('transition-transform', open && 'rotate-180')}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        // role="listbox"/"option" 이 아니라 **nav + 링크 목록**이다.
        //   정본(pullim-writing-coach #135)이 listbox 를 의도적으로 버린 이유: listbox 는 화살표
        //   이동·roving tabindex·active descendant 계약을 기대시키는데 실제 UI 는 링크 목록이라
        //   그 계약이 없어 보조기기 사용성이 깨진다. 같은 판단을 따른다.
        //   차이는 하나 — 우리는 `useDropdown` 이 방향키 이동(ArrowUp/Down·Home/End)을 실제로
        //   제공하므로 "계약만 선언하고 구현이 없는" 상태가 아니다. 그렇다고 role 을 listbox/menu 로
        //   올리지는 않는다: 이 항목들은 상태를 고르는 옵션이 아니라 **다른 서비스로 나가는 링크**라
        //   nav 가 의미상 옳고, 스크린리더의 링크 목록/랜드마크 탐색에도 그대로 잡힌다.
        //   또 항목에 `tabIndex={-1}` 을 주지 않는다(프로필 메뉴와 다른 점). 링크 목록의 기본 계약은
        //   Tab 순회이고, roving tabindex 는 그걸 뺏는 menu 위젯 관례다. 훅의 방향키는 tabindex 와
        //   무관하게 동작하므로 Tab·방향키가 모두 살아 있다.
        // 배치: 헤더 좌측(브랜드 옆)이라 sm+ 는 트리거 기준 좌측 정렬(OS `.switcher-menu left:0` 정합).
        //   모바일은 트리거가 이미 브랜드 폭만큼 안쪽이라 left-0 메뉴가 우측으로 잘린다(#136)
        //   → viewport 고정(fixed inset-x-3, 60px 헤더 아래)으로 화면 안에 전폭 표시.
        //   항목이 많아 낮은 기기(iPhone SE급)에서 넘칠 때를 위해 max-h + 세로 스크롤(#136).
        // z: topbar(z-[60])·모바일 탭바(z-[70])보다 위여야 가려지지 않는다.
        <nav
          {...menuProps}
          id={menuId}
          aria-label="서비스 전환"
          className="fixed inset-x-3 top-[68px] z-[80] max-h-[calc(100dvh-80px)] overflow-y-auto overflow-x-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-lg)] sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:w-[330px]"
        >
          <div className="px-2.5 pb-1.5 pt-2 font-[var(--font-mono)] text-[10px] uppercase tracking-[.16em] text-[var(--text-tertiary)]">
            서비스 전환
          </div>

          {/* OS 홈 — 형제 앱이 아니라 허브. 미설정 환경에서는 항목째 숨긴다(user-menu '설정'과 동형). */}
          {homeHref && (
            <a
              data-dropdown-item
              href={homeHref}
              onClick={close}
              className={cn(ITEM_CLASS, 'hover:bg-[var(--surface-sunken)]')}
            >
              <span className="grid h-[34px] w-[34px] flex-none place-items-center overflow-hidden rounded-[var(--radius-md)]">
                <ServiceIcon name="pullim" size={34} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
                  OS 홈
                </div>
                {/* 개수 표현 금지 — 이 목록은 개통 서비스만 노출(lib/pullim-services.ts)해서 OS 의
                    실제 서비스 수와 다르다. 어긋나는 숫자 대신 서술형으로(pullim-planner #147/#149 정합). */}
                <div className="text-[12px] text-[var(--text-tertiary)]">풀림 서비스를 한 곳에서</div>
              </div>
            </a>
          )}

          {services.map((svc) => {
            const isCurrent = svc.slug === CURRENT_SLUG;
            return (
              <SwitcherItem key={svc.slug} service={svc} isCurrent={isCurrent} onNavigate={close} />
            );
          })}
        </nav>
      )}
    </div>
  );
}

function SwitcherItem({
  service,
  isCurrent,
  onNavigate,
}: {
  service: SwitcherService;
  isCurrent: boolean;
  onNavigate: () => void;
}) {
  // 형제 서비스는 **별개 오리진**(q.pullim.ai·writing.pullim.ai …)이라 next/link 의 SPA 라우팅
  // 대상이 아니고, 세션 쿠키가 `Domain=.pullim.ai` 라 톱레벨 하드 내비게이션이어야 세션이 동반된다.
  // → 평범한 `<a href>`.
  // 반대로 현재 서비스(입시 코치, href '/')는 **같은 앱**이라 next/link 가 맞다 — 클라이언트 라우팅으로
  // 전체 리로드를 피한다. 분기 기준을 slug 가 아니라 href 모양으로 두는 이유: 실제로 SPA 라우팅이
  // 가능한지를 결정하는 건 "현재 서비스인가"가 아니라 "같은 오리진의 내부 경로인가"다.
  // (오늘은 두 조건이 일치한다 — 카탈로그가 현재 서비스에만 '/' 를 준다.)
  const internal = service.href.startsWith('/');

  const content = (
    <>
      <span className="grid h-[34px] w-[34px] flex-none place-items-center overflow-hidden rounded-[var(--radius-md)]">
        {/* aria-hidden — 바로 옆에 서비스명이 텍스트로 있어 role="img"+라벨이면 중복 낭독이 된다. */}
        <ServiceIcon name={service.icon} size={34} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[14px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
          {service.name}
          {isCurrent && (
            <span className="rounded-full bg-[var(--color-action-secondary)] px-1.5 py-0.5 font-[var(--font-mono)] text-[10px] font-semibold text-[var(--color-action-secondary-fg)]">
              현재
            </span>
          )}
        </div>
        <div className="truncate text-[12px] text-[var(--text-tertiary)]">{service.desc}</div>
      </div>
    </>
  );

  const className = cn(
    ITEM_CLASS,
    isCurrent ? 'bg-[var(--color-action-secondary)]' : 'hover:bg-[var(--surface-sunken)]',
  );
  // aria-current="page" — 강조 배경과 '현재' 배지가 보조기기에도 전달되게(색·배지만으로는 안 된다).
  const shared = {
    'data-dropdown-item': true,
    'aria-current': isCurrent ? ('page' as const) : undefined,
    onClick: onNavigate,
    className,
  };

  return internal ? (
    // typedRoutes 가 켜져 있어(next.config.mjs) href 가 리터럴 `Route` 여야 한다. 카탈로그의 href 는
    // 런타임 문자열이라 정적 검증이 불가능하므로 단언한다 — 위 `internal` 가드가 내부 경로임을
    // 보장한다(app/login/page.tsx 와 같은 처리).
    <Link href={service.href as Route} {...shared}>
      {content}
    </Link>
  ) : (
    <a href={service.href} {...shared}>
      {content}
    </a>
  );
}
