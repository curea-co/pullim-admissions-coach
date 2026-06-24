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
      <span className="text-[15px] font-extrabold tracking-[-.02em]">{title}</span>
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
  children,
  className,
}: DashboardShellProps) {
  const tabbarNode = Array.isArray(tabbar) ? <OsTabbar items={tabbar} /> : tabbar;
  return (
    <div className={cn("min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]", className)}>
      <header className="sticky top-0 z-40 flex h-[60px] items-center gap-4 border-b border-[var(--border-default)] bg-[var(--surface-raised)] px-4">
        <Brand brand={brand} />
        {switcher}
        <div className="flex-1" />
        {actions}
      </header>
      <div className="mx-auto flex w-full max-w-[1400px]">
        {rail && (
          <aside className="sticky top-[60px] hidden h-[calc(100vh-60px)] shrink-0 overflow-y-auto md:block">
            {rail}
          </aside>
        )}
        <main className="min-w-0 flex-1 px-6 py-8 pb-24 md:pb-8">{children}</main>
      </div>
      {tabbarNode}
    </div>
  );
}
