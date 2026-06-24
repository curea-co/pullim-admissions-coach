import * as React from "react";
import { cn } from "@/lib/cn";

export interface RailItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export interface OsRailProps {
  head: string;
  items: RailItem[];
  /** Icon-only collapsed mode. */
  collapsed?: boolean;
  /** Collapse/expand toggle — renders a button at the top of the rail. */
  onToggle?: () => void;
  className?: string;
}

export function OsRail({ head, items, collapsed = false, onToggle, className }: OsRailProps) {
  return (
    <nav
      aria-label={head}
      className={cn(
        "flex flex-col gap-0.5 p-3 transition-[width] duration-200",
        collapsed ? "w-[68px] items-center" : "w-64",
        className,
      )}
    >
      {!collapsed && (
        <div className="px-3 pb-1.5 pt-2 font-[var(--font-mono)] text-[10px] uppercase tracking-[.16em] text-[var(--text-tertiary)]">
          {head}
        </div>
      )}
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-expanded={!collapsed}
          className={cn(
            "mb-0.5 flex items-center rounded-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] [&_svg]:h-[19px] [&_svg]:w-[19px]",
            collapsed ? "h-[42px] w-[42px] justify-center" : "h-[42px] px-3",
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
          </svg>
        </button>
      )}
      {items.map((item) => (
        <a
          key={item.href + item.label}
          href={item.href}
          title={collapsed ? item.label : undefined}
          aria-label={item.label}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative flex items-center gap-[11px] rounded-[11px] text-[14px] font-medium text-[var(--text-secondary)] transition-colors duration-150",
            collapsed ? "h-[42px] w-[42px] justify-center" : "px-3 py-2.5",
            "hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
            "[&_svg]:h-[19px] [&_svg]:w-[19px]",
            item.active && "bg-[var(--color-action-secondary)] font-semibold text-[var(--color-action-primary)]",
            item.active && !collapsed &&
              "before:absolute before:bottom-[9px] before:left-[-14px] before:top-[9px] before:w-[3px] before:rounded-[0_3px_3px_0] before:bg-[var(--color-action-primary)] before:content-['']",
          )}
        >
          {item.icon}
          {!collapsed && <span>{item.label}</span>}
        </a>
      ))}
    </nav>
  );
}
