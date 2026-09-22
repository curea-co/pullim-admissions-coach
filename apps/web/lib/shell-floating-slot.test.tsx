import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardShell } from '../components/ui/dashboard-shell';

// 플로팅 액션(건의하기 FAB)이 **마지막 카드를 영구히 덮지 않도록** 본문 하단 여백을 넓히는 규칙.
// 함정은 데스크톱 분기다 — 모바일 pb 만 늘리면 `min-[921px]:pb-8` 이 그대로 덮어써서 데스크톱에서만
// 버튼이 콘텐츠 위에 앉는다. 두 분기를 함께 못박는다.
//
// 이 파일이 lib/ 에 있는 이유: vitest include 가 `lib/**`·`app/**` 뿐이다(vitest.config.ts).

const main = () => screen.getByRole('main');

describe('DashboardShell — 플로팅 슬롯', () => {
  it('슬롯이 비면 기존 하단 여백 그대로', () => {
    render(
      <DashboardShell brand={{ title: '풀림' }}>
        <p>본문</p>
      </DashboardShell>,
    );
    expect(main().className).toContain('min-[921px]:pb-8');
  });

  it('슬롯에 넘긴 노드를 렌더한다', () => {
    render(
      <DashboardShell brand={{ title: '풀림' }} floating={<button type="button">건의하기</button>}>
        <p>본문</p>
      </DashboardShell>,
    );
    expect(screen.getByRole('button', { name: '건의하기' })).toBeInTheDocument();
  });

  it('슬롯이 차면 모바일·데스크톱 **양쪽** 하단 여백을 넓힌다', () => {
    render(
      <DashboardShell brand={{ title: '풀림' }} floating={<button type="button">건의하기</button>}>
        <p>본문</p>
      </DashboardShell>,
    );
    const cls = main().className;
    // 모바일: 탭바(--tabbar-h + safe-area) 위로 버튼 높이만큼 더.
    expect(cls).toContain('pb-[calc(var(--tabbar-h)_+_env(safe-area-inset-bottom)_+_78px)]');
    // 데스크톱: 탭바가 없으므로 버튼 자리(24 + 52 + 여유)만.
    expect(cls).toContain('min-[921px]:pb-[calc(env(safe-area-inset-bottom)_+_92px)]');
    expect(cls).not.toContain('min-[921px]:pb-8');
  });
});

describe('DashboardShell — planner topbar 정합', () => {
  it('열기/접기 → 공통 아이콘·브랜드 → 서비스 전환 순서로 렌더한다', () => {
    const { container } = render(
      <DashboardShell
        brand={{ logo: <span data-testid="os-icon" />, title: '풀림', sub: '입시코치' }}
        rail={<nav>입시코치 메뉴</nav>}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        switcher={<button type="button">서비스 전환</button>}
      >
        <p>본문</p>
      </DashboardShell>,
    );

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(Array.from(header!.children).slice(0, 3).map((node) => node.textContent)).toEqual([
      '',
      '풀림입시코치',
      '서비스 전환',
    ]);
    expect(screen.getByTestId('os-icon')).toBeInTheDocument();
  });

  it('접기 버튼과 레일을 aria-controls로 연결하고 접어도 레일 DOM은 보존한다', () => {
    const { rerender } = render(
      <DashboardShell
        brand={{ title: '풀림' }}
        rail={<nav>입시코치 메뉴</nav>}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      >
        <p>본문</p>
      </DashboardShell>,
    );

    expect(screen.getByRole('button', { name: '사이드바 접기' })).toHaveAttribute(
      'aria-controls',
      'app-rail',
    );
    expect(containerRail()).toHaveClass('min-[921px]:block');

    rerender(
      <DashboardShell
        brand={{ title: '풀림' }}
        rail={<nav>입시코치 메뉴</nav>}
        collapsed
        onToggleCollapsed={vi.fn()}
      >
        <p>본문</p>
      </DashboardShell>,
    );

    expect(screen.getByRole('button', { name: '사이드바 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(containerRail()).toHaveClass('min-[921px]:hidden');
  });
});

function containerRail() {
  const rail = document.getElementById('app-rail');
  if (!rail) throw new Error('app-rail이 렌더되지 않았다');
  return rail;
}
