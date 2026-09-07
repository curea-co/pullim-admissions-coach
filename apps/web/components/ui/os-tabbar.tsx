import * as React from "react";
import { cn } from "@/lib/cn";

// 풀림 OS `.tabbar` 규격(pullim-web `src/styles/os-tokens.css`, ≤920px 에서만 노출):
//   fixed bottom · z-70 · 높이 62px + safe-area · 흰색 92% + blur(14px) · 상단 1px 라인
//   padding 6px 8px (하단은 6px + safe-area) · justify-content: space-around
//   아이템 = 세로 스택(아이콘 위/라벨 아래) gap 3px · 라벨 10.5px · 아이콘 21px · radius 12px
//   활성 = 브랜드 컬러

export interface TabbarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export interface OsTabbarProps {
  items: TabbarItem[];
  /** 네비게이션 링크 컴포넌트(기본 `<a>`). Next 앱은 `next/link` 의 Link 를 넘긴다. */
  linkComponent?: React.ElementType;
  className?: string;
}

export function OsTabbar({ items, linkComponent: Link = "a", className }: OsTabbarProps) {
  return (
    <nav
      aria-label="모바일 탭 메뉴"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[70] flex h-[calc(62px_+_env(safe-area-inset-bottom))] justify-around border-t border-[var(--border-default)] bg-white/[.92] px-2 pt-1.5 pb-[calc(6px_+_env(safe-area-inset-bottom))] backdrop-blur-[14px] min-[921px]:hidden",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-[3px] rounded-[12px] px-2.5 py-1.5 text-[10.5px] font-medium text-[var(--text-tertiary)] transition-colors",
            "[&_svg]:h-[21px] [&_svg]:w-[21px]",
            item.active && "text-[var(--color-action-primary)]",
          )}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
