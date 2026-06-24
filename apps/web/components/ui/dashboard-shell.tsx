import * as React from "react";
import { cn } from "@/lib/cn";
import { OsTabbar, type TabbarItem } from "./os-tabbar";

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
  /** Sidebar collapsed (icon-only) state. */
  collapsed?: boolean;
  /** Toggle handler — when provided, a collapse button shows in the topbar. */
  onToggleCollapsed?: () => void;
  children: React.ReactNode;
  className?: string;
}

function isBrandObject(
  b: BrandProp,
): b is { logo?: React.ReactNode; title: string; sub?: string; href?: string } {
  return typeof b === "object" && b !== null && "title" in b;
}

function Brand({ brand }: { brand: BrandProp }) {
  if (!isBrandObject(brand)) return <>{brand}</>;
  const { logo, title, sub, href = "/" } = brand;
  return (
    <a href={href} className="flex items-center gap-2 text-[var(--text-primary)] no-underline">
      {logo}
      <span className="text-[18px] font-extrabold tracking-[-.04em]">{title}</span>
      {sub && (
        <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-[.1em] text-[var(--text-tertiary)]">
          {sub}
        </span>
      )}
    </a>
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
  children,
  className,
}: DashboardShellProps) {
  const tabbarNode = Array.isArray(tabbar) ? <OsTabbar items={tabbar} /> : tabbar;
  return (
    <div className={cn("min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]", className)}>
      <header className="sticky top-0 z-40 flex h-[60px] items-center gap-3 border-b border-[var(--border-default)] bg-[var(--surface-raised)] px-4">
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-expanded={!collapsed}
            className="hidden h-9 w-9 items-center justify-center rounded-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] md:inline-flex"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
        )}
        <Brand brand={brand} />
        {switcher}
        <div className="flex-1" />
        {actions}
      </header>
      <div className="flex w-full">
        {rail && (
          <aside className="sticky top-[60px] hidden h-[calc(100vh-60px)] shrink-0 overflow-y-auto border-r border-[var(--border-subtle)] md:block">
            {rail}
          </aside>
        )}
        <main className="min-w-0 flex-1 px-6 py-8 pb-24 md:pb-8">{children}</main>
      </div>
      {tabbarNode}
    </div>
  );
}
