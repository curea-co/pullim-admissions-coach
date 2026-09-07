import * as React from "react";
import { cn } from "@/lib/cn";
import { OsTabbar, type TabbarItem } from "./os-tabbar";

// 풀림 OS 셸 규격(pullim-web `src/components/os/OsShell.tsx` + `src/styles/os-tokens.css`)을 옮긴 것.
//   - topbar 60px, 흰색 82% + blur(14px)/saturate(180%), 하단 1px 라인, sticky z-60
//   - 좌→우 순서: [레일 접기 토글] [브랜드] [서비스 스위처] [spacer] [actions]
//   - 접기 = **레일을 완전히 숨김**(미니 아이콘 레일 없음 — OS `.rail-collapsed .rail{display:none}`)
//   - 데스크톱/모바일 경계는 **920px**(OS 미디어쿼리). 920px 이하는 레일·토글 숨김 + 하단 탭바.
// 색은 이 앱의 PUDS 시맨틱 토큰(data-theme="pullim-os")으로 매핑하고, 토큰이 없는 치수(레일 폭
// 248px, z-index, 탭바 높이)만 OS 값을 그대로 쓴다.

export type BrandProp =
  | React.ReactNode
  | { logo?: React.ReactNode; title: string; sub?: string; href?: string };

export interface DashboardShellProps {
  brand: BrandProp;
  switcher?: React.ReactNode;
  actions?: React.ReactNode;
  /** Left navigation. Pass a labelled <nav> (e.g. OsRail) for landmark accessibility. */
  rail?: React.ReactNode;
  tabbar?: TabbarItem[] | React.ReactNode;
  /** 접힘 상태 — OS 와 동일하게 레일을 완전히 숨긴다(아이콘 전용 축소 없음). */
  collapsed?: boolean;
  /** Toggle handler — topbar 맨 왼쪽에 접기 버튼을 렌더한다(OS `.rail-collapse-btn`). */
  onToggleCollapsed?: () => void;
  /** 네비게이션에 쓸 링크 컴포넌트. Next 앱은 `next/link` 의 Link 를 넘겨 SPA 라우팅을 쓴다. */
  linkComponent?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}

function isBrandObject(
  b: BrandProp,
): b is { logo?: React.ReactNode; title: string; sub?: string; href?: string } {
  return typeof b === "object" && b !== null && "title" in b;
}

function Brand({
  brand,
  linkComponent: Link = "a",
}: {
  brand: BrandProp;
  linkComponent?: React.ElementType;
}) {
  if (!isBrandObject(brand)) return <>{brand}</>;
  const { logo, title, sub, href = "/" } = brand;
  return (
    <Link href={href} className="flex min-w-0 items-center gap-2.5 text-[var(--text-primary)] no-underline">
      {logo}
      <span className="text-[18px] font-extrabold tracking-[-.04em]">{title}</span>
      {/* 구분자는 문자가 아니라 세로 보더(OS `.mast .sub`). 560px 이하에서는 숨긴다. */}
      {sub && (
        <span className="ml-0.5 hidden border-l border-[var(--border-default)] pl-[9px] font-[var(--font-mono)] text-[11px] tracking-[.04em] text-[var(--text-tertiary)] min-[561px]:inline">
          {sub}
        </span>
      )}
    </Link>
  );
}

/** OS `.rail-collapse-btn` — topbar 맨 왼쪽 34×34 사각 버튼. 920px 이하에선 렌더하지 않는다. */
function RailCollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
      aria-expanded={!collapsed}
      className="mr-1 hidden h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-tertiary)] transition-colors duration-150 hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] min-[921px]:grid"
    >
      <svg
        viewBox="0 0 24 24"
        width="17"
        height="17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M9.5 4v16" />
      </svg>
    </button>
  );
}

export function DashboardShell({
  brand,
  switcher,
  actions,
  rail,
  tabbar,
  collapsed = false,
  onToggleCollapsed,
  linkComponent,
  children,
  className,
}: DashboardShellProps) {
  const tabbarNode = Array.isArray(tabbar) ? <OsTabbar items={tabbar} linkComponent={linkComponent} /> : tabbar;
  return (
    <div className={cn("min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]", className)}>
      <header className="sticky top-0 z-[60] flex h-[60px] items-center gap-2.5 border-b border-[var(--border-default)] bg-white/[.82] px-[14px] backdrop-blur-[14px] backdrop-saturate-[1.8] min-[921px]:gap-[18px] min-[921px]:px-[22px]">
        {rail && onToggleCollapsed && (
          <RailCollapseToggle collapsed={collapsed} onToggle={onToggleCollapsed} />
        )}
        <Brand brand={brand} linkComponent={linkComponent} />
        {switcher}
        <div className="flex-1" />
        {actions}
      </header>
      <div className="flex w-full">
        {rail && !collapsed && (
          <aside className="sticky top-[60px] hidden h-[calc(100vh-60px)] shrink-0 overflow-y-auto border-r border-[var(--border-default)] bg-[var(--surface-raised)] min-[921px]:block">
            {rail}
          </aside>
        )}
        {/* 모바일 하단 패딩은 탭바(62px + safe-area) 높이만큼 비운다 — OS `.main` 과 동일. */}
        <main
          id="main-content"
          className="min-w-0 flex-1 px-[18px] py-[22px] pb-[calc(96px_+_env(safe-area-inset-bottom))] min-[921px]:px-6 min-[921px]:py-8 min-[921px]:pb-8"
        >
          {children}
        </main>
      </div>
      {tabbarNode}
    </div>
  );
}
