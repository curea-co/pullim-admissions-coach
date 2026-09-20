import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDropdown, type UseDropdownOptions } from './use-dropdown';

// useDropdown 단독 회귀 고정 — 소비처(user-menu·서비스 스위처·알림)를 거치지 않고 훅 자체를
// 최소 하네스에 붙여 열기/닫기·포커스 경로를 못 박는다. 특히 아래 두 경로는 실제 회귀 이력이
// 있으므로 브라우저 실제 이벤트 순서를 그대로 재현한다:
//   - Codex #70 4차: 트리거 재클릭 = mousedown → 메뉴 focusout(relatedTarget=트리거) → click
//   - Codex #70 5차: Shift+Tab 으로 트리거 복귀 = mousedown 없이 focusout(relatedTarget=트리거)

/** role="menu" 구조 하네스 — 프로필 메뉴와 같은 형태(기본 itemSelector). */
function MenuHarness({
  labels = ['하나', '둘', '셋'],
  attachRoot = true,
  ...options
}: UseDropdownOptions & { labels?: string[]; attachRoot?: boolean }) {
  const { open, close, focusTrigger, rootProps, triggerProps, menuProps } = useDropdown(options);
  return (
    <div {...(attachRoot ? rootProps : {})} className="relative">
      <button {...triggerProps} type="button" aria-haspopup="menu" aria-label="메뉴 열기">
        트리거
      </button>
      <button type="button" onClick={focusTrigger}>
        트리거로 포커스
      </button>
      {open && (
        <div {...menuProps} role="menu" aria-label="테스트 메뉴">
          {labels.map((label) => (
            <button key={label} role="menuitem" tabIndex={-1} type="button" onClick={close}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** nav + 링크 목록 하네스 — role 을 훅이 강제하지 않는지, itemSelector 주입이 먹는지 확인. */
function NavHarness() {
  const { open, rootProps, triggerProps, menuProps } = useDropdown({
    itemSelector: 'a[data-dropdown-item]',
  });
  return (
    <div {...rootProps}>
      <button {...triggerProps} type="button" aria-label="서비스 전환">
        서비스
      </button>
      {open && (
        <nav {...menuProps} aria-label="서비스 목록">
          {['Q', '플래너', '글쓰기'].map((name) => (
            <a key={name} data-dropdown-item tabIndex={-1} href={`/${name}`}>
              {name}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

const trigger = () => screen.getByRole('button', { name: '메뉴 열기' });
const openMenu = () => fireEvent.click(trigger());
const items = () => screen.getAllByRole('menuitem');
const menu = () => screen.getByRole('menu');

describe('useDropdown — 열기/닫기', () => {
  it('초기엔 닫혀 있고 aria-expanded=false', () => {
    render(<MenuHarness />);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('트리거 클릭 → 열리고 aria-expanded=true, 첫 항목에 포커스', async () => {
    render(<MenuHarness />);
    openMenu();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(items()[0]).toHaveFocus());
  });

  it('mousedown 없는 클릭(Enter/Space 키보드 활성화)으로도 토글된다', () => {
    render(<MenuHarness />);
    openMenu();
    expect(menu()).toBeInTheDocument();
    openMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('바깥 mousedown → 닫힌다. 루트 안쪽 mousedown 은 유지', () => {
    render(<MenuHarness />);
    openMenu();
    fireEvent.mouseDown(items()[1]);
    expect(menu()).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Escape → 닫히고 트리거로 포커스가 돌아온다', async () => {
    render(<MenuHarness />);
    openMenu();
    await waitFor(() => expect(items()[0]).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('close() 로 프로그램적으로 닫는다(항목 선택 후)', () => {
    render(<MenuHarness />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: '둘' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('focusTrigger() 로 트리거에 포커스를 되돌린다', () => {
    render(<MenuHarness />);
    fireEvent.click(screen.getByRole('button', { name: '트리거로 포커스' }));
    expect(trigger()).toHaveFocus();
  });
});

describe('useDropdown — 트리거 재클릭·focusout (회귀 이력)', () => {
  // Codex #70 4차 — 브라우저 실제 순서는 트리거 mousedown → 메뉴 focusout(relatedTarget=트리거)
  // → click 이라, focusout 이 먼저 닫고 click 이 다시 여는 깜빡임이 났었다.
  it('열린 상태에서 트리거를 다시 클릭하면 닫힌다(다시 열리지 않는다)', async () => {
    render(<MenuHarness />);
    openMenu();
    await waitFor(() => expect(items()[0]).toHaveFocus());
    const btn = trigger();
    fireEvent.mouseDown(btn);
    fireEvent.focusOut(menu(), { relatedTarget: btn });
    fireEvent.click(btn);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // Codex #70 5차 — 4차 수정(트리거를 메뉴 안쪽으로 판정)이 막았던 경로. mousedown 이 없다.
  it('Shift+Tab 으로 트리거에 되돌아가면 닫힌다', async () => {
    render(<MenuHarness />);
    openMenu();
    await waitFor(() => expect(items()[0]).toHaveFocus());
    fireEvent.focusOut(menu(), { relatedTarget: trigger() });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Tab 으로 바깥으로 나가면 닫힌다', () => {
    render(<MenuHarness />);
    openMenu();
    fireEvent.focusOut(menu(), { relatedTarget: document.body });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('메뉴 안 항목으로 포커스가 옮겨가는 focusout 은 닫지 않는다', () => {
    render(<MenuHarness />);
    openMenu();
    fireEvent.focusOut(menu(), { relatedTarget: items()[2] });
    expect(menu()).toBeInTheDocument();
  });
});

describe('useDropdown — 방향키 로빙', () => {
  it('닫힌 트리거에 ArrowDown → 열리고 첫 항목으로', async () => {
    render(<MenuHarness />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    await waitFor(() => expect(items()[0]).toHaveFocus());
  });

  // ARIA menu button 규약 — 트리거의 ArrowUp 은 마지막 항목으로 연다(Codex #70 3차).
  it('닫힌 트리거에 ArrowUp → 열리고 마지막 항목으로', async () => {
    render(<MenuHarness />);
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    await waitFor(() => {
      const list = items();
      expect(list[list.length - 1]).toHaveFocus();
    });
  });

  it('클릭으로 다시 열면 ArrowUp 이력과 무관하게 첫 항목으로', async () => {
    render(<MenuHarness />);
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    await waitFor(() => expect(items()[items().length - 1]).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    openMenu();
    await waitFor(() => expect(items()[0]).toHaveFocus());
  });

  it('메뉴 안 ArrowDown/ArrowUp 순환 · Home/End', async () => {
    render(<MenuHarness />);
    openMenu();
    await waitFor(() => expect(items()[0]).toHaveFocus());
    fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(items()[1]).toHaveFocus();
    fireEvent.keyDown(menu(), { key: 'End' });
    expect(items()[2]).toHaveFocus();
    fireEvent.keyDown(menu(), { key: 'ArrowDown' }); // 마지막 → 처음으로 순환
    expect(items()[0]).toHaveFocus();
    fireEvent.keyDown(menu(), { key: 'ArrowUp' }); // 처음 → 마지막으로 순환
    expect(items()[2]).toHaveFocus();
    fireEvent.keyDown(menu(), { key: 'Home' });
    expect(items()[0]).toHaveFocus();
  });

  it('항목이 없으면 방향키가 아무 일도 하지 않는다(빈 메뉴)', () => {
    render(<MenuHarness labels={[]} />);
    openMenu();
    fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(menu()).toBeInTheDocument();
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });
});

describe('useDropdown — 옵션', () => {
  it('itemSelector 주입: nav + 링크 목록에서도 로빙이 동작한다(role 을 강제하지 않는다)', async () => {
    render(<NavHarness />);
    const btn = screen.getByRole('button', { name: '서비스 전환' });
    fireEvent.keyDown(btn, { key: 'ArrowUp' });
    const links = () => screen.getAllByRole('link');
    await waitFor(() => expect(links()[2]).toHaveFocus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('navigation'), { key: 'Home' });
    expect(links()[0]).toHaveFocus();
  });

  it('roving:false → 자동 포커스·트리거 방향키 열기·메뉴 방향키를 모두 끈다', () => {
    render(<MenuHarness roving={false} />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    openMenu();
    expect(items()[0]).not.toHaveFocus();
    items()[1].focus();
    fireEvent.keyDown(menu(), { key: 'ArrowDown' });
    expect(items()[1]).toHaveFocus(); // 방향키 무시 — 브라우저 기본 Tab 이동에 맡긴다
  });

  it('roving:false 여도 Esc·바깥 클릭·focusout 닫기는 그대로다', () => {
    render(<MenuHarness roving={false} />);
    openMenu();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('rootProps 를 붙이지 않아도 트리거·메뉴 안쪽 mousedown 은 닫지 않는다(폴백)', () => {
    render(<MenuHarness attachRoot={false} />);
    openMenu();
    fireEvent.mouseDown(items()[0]);
    expect(menu()).toBeInTheDocument();
    fireEvent.mouseDown(trigger());
    expect(menu()).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
