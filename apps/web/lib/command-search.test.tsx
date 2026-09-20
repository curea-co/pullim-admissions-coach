import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CommandSearch } from '../components/shell/command-search';

// ⌘K 팔레트 회귀 고정. 이 컴포넌트는 전역 키 리스너·포털·포커스 복귀처럼 수동 확인으로는
// 놓치기 쉬운 브라우저 동작에 의존한다.
//
// 이 파일이 components/ 가 아니라 lib/ 에 있는 이유: vitest include 가 `lib/**` 와 `app/**`
// 뿐이라(apps/web/vitest.config.ts) components/ 아래 테스트는 **수집되지 않는다**.

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

const trigger = () => screen.getByRole('button', { name: '검색' });
const input = () => screen.getByRole('combobox', { name: '화면 검색' });
const options = () => screen.getAllByRole('option');
const openPalette = async () => {
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
};

beforeEach(() => {
  vi.clearAllMocks();
  document.body.style.overflow = '';
});

describe('CommandSearch — 트리거', () => {
  it('닫힌 상태: 아이콘 버튼만 있고 모달은 없다', () => {
    render(<CommandSearch />);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('title 에 단축키를 표기한다', () => {
    render(<CommandSearch />);
    // jsdom 은 Mac 이 아니므로 Ctrl 표기. 실제 Mac 에서는 마운트 후 ⌘K 로 바뀐다.
    expect(trigger()).toHaveAttribute('title', '검색 (Ctrl+K)');
  });

  it('클릭으로 연다', async () => {
    render(<CommandSearch />);
    fireEvent.click(trigger());
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('CommandSearch — 단축키', () => {
  it('⌘K 로 열린다', async () => {
    render(<CommandSearch />);
    await openPalette();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('Ctrl+K 로도 열린다(윈도우·리눅스)', async () => {
    render(<CommandSearch />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('수식키 없는 k 로는 열리지 않는다', () => {
    render(<CommandSearch />);
    fireEvent.keyDown(document, { key: 'k' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('폼 입력 중에는 열지 않는다 — 생기부를 붙여넣는 중에 화면을 가로채면 안 된다', () => {
    render(
      <>
        <textarea aria-label="생기부 본문" />
        <CommandSearch />
      </>,
    );
    const ta = screen.getByLabelText('생기부 본문');
    ta.focus();
    fireEvent.keyDown(ta, { key: 'k', metaKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CommandSearch — 열림/닫힘과 포커스', () => {
  it('열리면 입력에 포커스가 간다', async () => {
    render(<CommandSearch />);
    await openPalette();
    await waitFor(() => expect(input()).toHaveFocus());
  });

  it('Escape → 닫히고 트리거로 포커스가 돌아온다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('오버레이 클릭 → 닫힌다. 모달 안쪽 클릭은 닫지 않는다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('command-search-overlay'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('열린 동안 배경 스크롤을 잠그고, 닫으면 원래대로 되돌린다', async () => {
    render(<CommandSearch />);
    await openPalette();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
  });

  it('다시 열면 이전 질의가 남아 있지 않다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.change(input(), { target: { value: '면접' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    await openPalette();
    expect(input()).toHaveValue('');
  });
});

describe('CommandSearch — 결과 목록', () => {
  it('빈 질의면 레일 4 + 결과 탭 3 을 전부 보여준다', async () => {
    render(<CommandSearch />);
    await openPalette();
    expect(options()).toHaveLength(7);
    expect(options()[0]).toHaveTextContent('홈');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('한글 질의로 좁혀진다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.change(input(), { target: { value: '진단' } });
    expect(options().map((o) => o.textContent)).toHaveLength(2);
    expect(screen.getByRole('option', { name: /생기부 진단 가이드/ })).toBeInTheDocument();
  });

  it('매칭 0건이면 정직한 빈 상태를 보여준다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.change(input(), { target: { value: 'zzzzzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('일치하는 화면이 없어요.');
  });

  it('방향키로 이동하고 aria-activedescendant 가 따라온다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    expect(input()).toHaveAttribute('aria-activedescendant', options()[1].id);

    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    // 처음에서 위 → 마지막으로 순환.
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(options()[6]).toHaveAttribute('aria-selected', 'true');
  });

  it('마우스 hover 가 선택을 동기화한다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.mouseEnter(options()[3]);
    expect(options()[3]).toHaveAttribute('aria-selected', 'true');
  });

  it('질의를 바꾸면 선택이 첫 항목으로 돌아간다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.change(input(), { target: { value: '진단' } });
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('한글 IME 조합 중 Enter/방향키는 가로채지 않는다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('CommandSearch — 이동', () => {
  it('Enter → 선택 항목 경로로 router.push', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ArrowDown 후 Enter → 두 번째 항목 경로', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/submit');
  });

  it('결과 탭은 ?tab= 딥링크로 이동한다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.change(input(), { target: { value: '생기부 진단 가이드' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/result?tab=diagnosis');
  });

  it('클릭으로도 이동한다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.click(screen.getByRole('option', { name: /부족 활동 보완안/ }));
    expect(push).toHaveBeenCalledWith('/result?tab=improvements');
  });

  it('결과가 0건이면 Enter 는 아무 데도 보내지 않는다', async () => {
    render(<CommandSearch />);
    await openPalette();
    fireEvent.change(input(), { target: { value: 'zzzzzz' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
