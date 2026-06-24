'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { OsRail } from '@/components/ui/os-rail';
import { PullimLogo } from '@/components/pullim-logo';

// 입시 코치 대시보드 구조 — 풀림 OS/classbot 패턴(좌측 레일 + 상단 바 + 콘텐츠).
const NAV: { label: string; href: string; icon: React.ReactNode }[] = [
  { label: '홈', href: '/', icon: <IconHome /> },
  { label: '생기부 제출', href: '/submit', icon: <IconUpload /> },
  { label: '진단 결과', href: '/result', icon: <IconChart /> },
  { label: '학부모 리포트', href: '/parent', icon: <IconUsers /> },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

const RAIL_KEY = 'puds-rail-collapsed';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const items = NAV.map((n) => ({ ...n, active: isActive(pathname, n.href) }));

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(RAIL_KEY) === '1') setCollapsed(true);
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(RAIL_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });

  return (
    <DashboardShell
      brand={{ logo: <PullimLogo size={30} />, title: '풀림 입시코치', href: '/' }}
      rail={<OsRail head="입시코치" items={items} collapsed={collapsed} />}
      tabbar={items}
      collapsed={collapsed}
      onToggleCollapsed={toggle}
    >
      {children}
    </DashboardShell>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M3 20h18" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 6a3 3 0 0 1 0 6" /><path d="M18 20a6 6 0 0 0-3-5" />
    </svg>
  );
}
