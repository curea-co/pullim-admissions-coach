import * as React from "react";
import { cn } from "@/lib/cn";

export interface TabbarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export interface OsTabbarProps {
  items: TabbarItem[];
  className?: string;
}

export function OsTabbar({ items, className }: OsTabbarProps) {
  return (
    <nav
      aria-label="모바일 탭 메뉴"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex border-t border-[var(--border-default)] bg-[var(--surface-raised)] pb-[env(safe-area-inset-bottom)] md:hidden",
        className,
      )}
    >
      {items.map((item) => (
        <a
          key={item.href + item.label}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-[var(--text-tertiary)] transition-colors",
            "[&_svg]:h-[22px] [&_svg]:w-[22px]",
            item.active && "text-[var(--color-action-primary)]",
          )}
        >
          {item.icon}
          {item.label}
        </a>
      ))}
    </nav>
  );
}
