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
  className?: string;
}

export function OsRail({ head, items, className }: OsRailProps) {
  return (
    <nav
      aria-label={head}
      className={cn("flex w-64 flex-col gap-0.5 p-3", className)}
    >
      <div className="px-3 pb-1.5 pt-2 font-[var(--font-mono)] text-[11px] uppercase tracking-[.14em] text-[var(--text-tertiary)]">
        {head}
      </div>
      {items.map((item) => (
        <a
          key={item.href + item.label}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative flex items-center gap-[11px] rounded-[11px] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150",
            "hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
            "[&_svg]:h-[19px] [&_svg]:w-[19px]",
            item.active &&
              "bg-[var(--color-action-secondary)] font-semibold text-[var(--color-action-primary)] before:absolute before:bottom-[9px] before:left-[-14px] before:top-[9px] before:w-[3px] before:rounded-[0_3px_3px_0] before:bg-[var(--color-action-primary)] before:content-['']",
          )}
        >
          {item.icon}
          {item.label}
        </a>
      ))}
    </nav>
  );
}
