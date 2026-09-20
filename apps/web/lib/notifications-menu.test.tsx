import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotificationsMenu } from '../components/shell/notifications-menu';

// topbar 알림 창구 회귀 고정.
//
// 이 파일이 components/ 가 아니라 lib/ 에 있는 이유: vitest include 가 `lib/**` 와 `app/**` 뿐이라
// (apps/web/vitest.config.ts) components/ 아래 테스트는 **수집되지 않는다**. 옆 파일들(user-menu·
// use-dropdown 테스트)도 같은 이유로 여기에 있다.

const trigger = () => screen.getByRole('button', { name: '알림' });
const openPanel = () => fireEvent.click(trigger());
const panel = () => screen.getByRole('dialog', { name: '알림' });

describe('NotificationsMenu — 열기/닫기', () => {
  it('초기엔 닫혀 있고 aria-expanded=false', () => {
    render(<NotificationsMenu />);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('클릭으로 열면 aria-expanded=true 이고 빈 상태 문구가 보인다', () => {
    render(<NotificationsMenu />);
    openPanel();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(panel()).toBeInTheDocument();
    expect(screen.getByText('받은 알림이 없어요')).toBeInTheDocument();
    expect(screen.getByText('중요한 소식이 생기면 여기로 알려드릴게요.')).toBeInTheDocument();
  });

  it('트리거를 다시 클릭하면 닫힌다', () => {
    render(<NotificationsMenu />);
    openPanel();
    openPanel();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Escape → 닫히고 트리거로 포커스가 돌아온다', () => {
    render(<NotificationsMenu />);
    openPanel();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('바깥 mousedown → 닫힌다 (패널 안쪽 mousedown 은 유지)', () => {
    render(<NotificationsMenu />);
    openPanel();
    fireEvent.mouseDown(screen.getByText('받은 알림이 없어요'));
    expect(panel()).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('NotificationsMenu — 포커스', () => {
  // roving 을 껐기 때문에 훅이 포커스를 옮겨 주지 않는다. 컴포넌트가 직접 패널로 포커스를
  // 옮기는데, 이게 없으면 (1) 스크린리더가 패널 내용을 읽지 않고 (2) 포커스가 패널에 들어간
  // 적이 없어 Tab 이탈 시 닫히지 않는다. 두 경로를 함께 고정한다.
  it('열면 패널로 포커스가 들어간다', async () => {
    render(<NotificationsMenu />);
    openPanel();
    await waitFor(() => expect(panel()).toHaveFocus());
  });

  it('Tab 으로 패널 바깥으로 나가면 닫힌다', () => {
    render(<NotificationsMenu />);
    openPanel();
    fireEvent.focusOut(panel(), { relatedTarget: document.body });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('NotificationsMenu — 정직성(미읽음 배지 없음)', () => {
  // 알림 발송 인프라가 없어 실제 미읽음은 언제나 0 이다. pullim-planner 는 점 배지를 넣었다가
  // "안 읽은 알림 있음" 오해를 준다는 이유로 **의도적으로 제거**했다. 나중에 누군가 "곧 붙일
  // 거니까" 하고 점을 켜면 이 테스트가 잡는다 — 실제 미읽음 소스를 붙이는 커밋에서 함께
  // 고치라는 뜻이다. 배지를 지운 것은 취향이 아니라 정의 §6(정직성 가드레일) 준수다.
  it('트리거 안에는 종 아이콘 하나뿐 — 점 배지 엘리먼트가 없다', () => {
    const { container } = render(<NotificationsMenu />);
    expect(trigger().querySelectorAll('svg')).toHaveLength(1);
    expect(trigger().querySelectorAll('span, i, em, div')).toHaveLength(0);
    // 점 배지는 예외 없이 원형이다 — rounded-full 흔적조차 없어야 한다.
    expect(container.querySelector('[class*="rounded-full"]')).toBeNull();
  });

  it('접근성 이름에 건수를 넣지 않는다 ("알림 0건" 같은 소음 금지)', () => {
    render(<NotificationsMenu />);
    expect(trigger()).toHaveAccessibleName('알림');
    openPanel();
    expect(trigger()).toHaveAccessibleName('알림');
  });
});
