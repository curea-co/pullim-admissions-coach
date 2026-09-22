'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { OsRail } from '@/components/ui/os-rail';
import { ServiceIcon } from '@/components/ui/service-icon';
import { UserMenu } from '@/components/auth/user-menu';
import { ServiceSwitcher } from '@/components/shell/service-switcher';
import { CommandSearch } from '@/components/shell/command-search';
import { NotificationsMenu } from '@/components/shell/notifications-menu';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
import { isFeedbackEnabled } from '@/lib/feedback';

// 입시 코치 대시보드 구조 — 풀림 OS/classbot 패턴(좌측 레일 + 상단 바 + 콘텐츠).
const NAV: { label: string; href: string; icon: React.ReactNode }[] = [
  { label: '홈', href: '/', icon: <IconHome /> },
  { label: '생기부 제출', href: '/submit', icon: <IconUpload /> },
  { label: '진단 내역', href: '/result', icon: <IconChart /> },
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
      // planner topbar 와 같은 mast: 공통 풀림 아이콘 뒤에 서비스명, 그 다음 서비스 전환.
      // 현재 서비스 전용 아이콘은 바로 뒤 스위처가 소유하므로 mast 에서 중복하지 않는다.
      brand={{
        logo: <ServiceIcon name="pullim" size={30} aria-hidden />,
        title: '풀림',
        sub: '입시코치',
        href: '/',
      }}
      rail={<OsRail head="입시코치" items={items} linkComponent={Link} />}
      tabbar={items}
      collapsed={collapsed}
      onToggleCollapsed={toggle}
      // 레일·탭바·브랜드 로고를 next/link 로 — <a> 하드코딩이면 클릭마다 풀 페이지 리로드가 된다.
      linkComponent={Link}
      // 우하단 플로팅 — 건의하기(NEXT_PUBLIC_FEEDBACK_ENABLED=true 일 때만). 여기서 플래그를
      // 판정해 null 을 넘기는 이유: 슬롯이 비어야 셸이 본문 하단 여백도 되돌린다(보이지도 않는
      // 버튼 자리를 비워 두지 않게).
      floating={isFeedbackEnabled() ? <FeedbackWidget /> : null}
      // topbar 좌측 [열기/접기][공통 아이콘·브랜드][스위처] — planner `AppHeader` 순서.
      // 스위처는 카탈로그가 비면(= OS URL 미설정)
      // 스스로 null 을 반환하므로 여기서 조건부로 감싸지 않는다.
      switcher={<ServiceSwitcher />}
      // topbar 우측 [검색][알림][프로필]. 세 버튼은 각자 자립형(트리거+패널+리스너 포함)이라
      // 여기서는 정렬만 준다. gap 은 헤더 자체 gap(2.5)보다 좁게 — 셋이 한 덩어리로 읽혀야 한다.
      actions={
        <div className="flex items-center gap-0.5 min-[421px]:gap-1.5">
          <CommandSearch />
          <NotificationsMenu />
          <UserMenu />
        </div>
      }
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
