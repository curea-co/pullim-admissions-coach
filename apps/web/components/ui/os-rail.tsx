import * as React from "react";
import { cn } from "@/lib/cn";

// 풀림 OS `.rail` 규격(pullim-web `src/styles/os-tokens.css`):
//   폭 248px 고정(--rail-w) · padding 18px 14px · 아이템 간 gap 4px · 흰 배경
//   그룹 라벨(.rail-head) = mono 10px / uppercase / letter-spacing .16em
//   아이템(.nav-item) = padding 10px 12px · radius 11px · gap 11px · 14px/500 · 아이콘 19px
//   활성(.nav-item.active) = 연한 브랜드 틴트 배경 + 브랜드 컬러 텍스트 + 600 +
//     좌측 3px 바(::before, left:-14px → rail 패딩 밖으로 나가 레일 왼쪽 끝에 붙는다)
// 접힘(아이콘 전용) 모드는 OS 에 없다 — 접으면 레일을 통째로 숨긴다(DashboardShell 소관).

export interface RailItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export interface OsRailProps {
  head: string;
  items: RailItem[];
  /** 네비게이션 링크 컴포넌트(기본 `<a>`). Next 앱은 `next/link` 의 Link 를 넘긴다. */
  linkComponent?: React.ElementType;
  className?: string;
}

export function OsRail({ head, items, linkComponent: Link = "a", className }: OsRailProps) {
  return (
    <nav
      aria-label={head}
      className={cn(
        "flex w-[248px] flex-col gap-1 bg-[var(--surface-raised)] px-[14px] py-[18px]",
        className,
      )}
    >
      <div className="px-3 pb-1.5 pt-2.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[.16em] text-[var(--text-tertiary)]">
        {head}
      </div>
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative flex items-center gap-[11px] rounded-[11px] px-3 py-2.5 text-[14px] font-medium text-[var(--text-secondary)] transition-colors duration-150",
            "hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
            "[&_svg]:h-[19px] [&_svg]:w-[19px]",
            item.active &&
              "bg-[var(--color-action-secondary)] font-semibold text-[var(--color-action-primary)]",
            item.active &&
              "before:absolute before:bottom-[9px] before:left-[-14px] before:top-[9px] before:w-[3px] before:rounded-[0_3px_3px_0] before:bg-[var(--color-action-primary)] before:content-['']",
          )}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
