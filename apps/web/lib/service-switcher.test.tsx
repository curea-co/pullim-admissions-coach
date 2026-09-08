import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ServiceSwitcher } from '../components/shell/service-switcher';
import type { SwitcherService } from './pullim-services';

// topbar 서비스 스위처 회귀 고정.
//
// ⚠️ 이 파일이 `lib/` 에 있는 이유: vitest include 가 `lib/**` 와 `app/**` 뿐이라 `components/`
//    아래 테스트는 **수집조차 되지 않는다**(vitest.config.ts). 옮기면 조용히 안 돌아간다.
//
// 카탈로그(`@/lib/pullim-services`)는 stub 한다 — 티어 파생·env 규칙은 그쪽 테스트
// (lib/pullim-services.test.ts)의 책임이고, 여기서는 "목록·허브 URL 이 이렇게 주어졌을 때 어떻게
// 그리는가"만 고정해야 카탈로그가 바뀌어도 이 테스트가 흔들리지 않는다.
// 그래서 `osHubHref` 도 함께 스텁한다(빠뜨리면 undefined 호출로 렌더가 깨진다).
// 팩토리 안에서 `let` 변수를 바로 읽지 않고 함수로 감싸는 이유는 vi.mock 호이스팅 때문(TDZ) —
// lib/user-menu.test.tsx 의 `osSettingsHref: () => settingsHref` 와 같은 형태다.

const FULL_LIST: SwitcherService[] = [
  { slug: 'planner', name: '플래너', icon: 'planner', href: 'https://planner.pullim.ai/planner', desc: '내 공부, 내가 설계한다.' },
  { slug: 'q', name: '문제큐', icon: 'q', href: 'https://q.pullim.ai', desc: '풀고, 틀리고, 다시 자라난다.' },
  { slug: 'exam', name: '입시 코치', icon: 'exam', href: '/', desc: '생기부를 진단하고, 면접을 준비한다.' },
];

let services: SwitcherService[] = FULL_LIST;
let hubHref: string | null = 'https://pullim.ai';

vi.mock('@/lib/pullim-services', () => ({
  CURRENT_SLUG: 'exam',
  switcherServices: () => services,
  osHubHref: () => hubHref,
}));

// next/link 를 감별 가능한 앵커로 바꿔 둔다 — 렌더 결과만 보면 next/link 와 <a> 가 똑같이
// `<a href>` 라서, "형제 앱은 하드 내비게이션 / 현재 서비스만 SPA" 분기를 DOM 으로 구분할 수 없다.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a data-next-link="true" href={href} {...rest}>
      {children}
    </a>
  ),
}));

const trigger = () => screen.getByRole('button', { name: '서비스 전환' });
const openMenu = () => fireEvent.click(trigger());
const items = () => screen.getAllByRole('link');

beforeEach(() => {
  services = FULL_LIST;
  hubHref = 'https://pullim.ai';
});

describe('ServiceSwitcher — 트리거', () => {
  it('현재 서비스명을 보여주고 aria-expanded 는 false 로 시작한다', () => {
    render(<ServiceSwitcher />);
    expect(trigger()).toHaveTextContent('입시 코치');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    // 닫힌 상태에서는 목록이 없다.
    expect(screen.queryByRole('navigation', { name: '서비스 전환' })).not.toBeInTheDocument();
  });

  it('클릭하면 열리고 aria-expanded 가 true 가 된다', async () => {
    render(<ServiceSwitcher />);
    openMenu();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: '서비스 전환' })).toBeInTheDocument();
    // 훅의 로빙 포커스가 열자마자 첫 항목(OS 홈)으로 옮겨간다.
    await waitFor(() => expect(items()[0]).toHaveFocus());
  });
});

describe('ServiceSwitcher — 목록', () => {
  it('OS 홈 + 서비스 전체가 나오고, 현재 서비스에 aria-current 와 "현재" 배지가 붙는다', () => {
    render(<ServiceSwitcher />);
    openMenu();

    expect(items().map((el) => el.textContent)).toEqual([
      'OS 홈풀림 서비스를 한 곳에서',
      '플래너내 공부, 내가 설계한다.',
      '문제큐풀고, 틀리고, 다시 자라난다.',
      '입시 코치현재생기부를 진단하고, 면접을 준비한다.',
    ]);

    const currentItem = screen.getByRole('link', { name: /입시 코치/ });
    expect(currentItem).toHaveAttribute('aria-current', 'page');
    expect(currentItem).toHaveTextContent('현재');
    // 현재 서비스에만 붙는다 — 강조가 번지면 "지금 어디에 있는지"가 무의미해진다.
    expect(screen.getByRole('link', { name: /플래너/ })).not.toHaveAttribute('aria-current');
  });

  it('OS 홈 설명에 개수를 쓰지 않는다', () => {
    // 이 목록은 개통 서비스만 노출해서 OS 실제 서비스 수와 다르다 — 숫자를 적으면 반드시
    // 어긋난다(pullim-planner #147/#149). 서술형 카피를 회귀로 고정한다.
    render(<ServiceSwitcher />);
    openMenu();
    expect(screen.getByRole('link', { name: /OS 홈/ })).not.toHaveTextContent(/\d+\s*개/);
  });

  it('형제 서비스는 <a href> 절대 URL, 현재 서비스는 내부 링크(next/link)', () => {
    render(<ServiceSwitcher />);
    openMenu();

    // 형제 앱은 별개 오리진 + 쿠키 Domain=.pullim.ai → 톱레벨 하드 내비게이션이어야 세션이 동반된다.
    const sibling = screen.getByRole('link', { name: /플래너/ });
    expect(sibling).toHaveAttribute('href', 'https://planner.pullim.ai/planner');
    expect(sibling).not.toHaveAttribute('data-next-link');

    // 현재 서비스는 같은 앱 → SPA 라우팅(next/link).
    const current = screen.getByRole('link', { name: /입시 코치/ });
    expect(current).toHaveAttribute('href', '/');
    expect(current).toHaveAttribute('data-next-link', 'true');

    // OS 홈은 허브(형제 앱이 아님) — origin 만, 경로를 덧붙이지 않는다.
    expect(screen.getByRole('link', { name: /OS 홈/ })).toHaveAttribute('href', 'https://pullim.ai');
  });
});

describe('ServiceSwitcher — 카탈로그 계약', () => {
  it('switcherServices() 가 빈 배열이면 아무것도 렌더하지 않는다', () => {
    // 계약 1 회귀 가드. 빈 배열 = NEXT_PUBLIC_OS_URL 미설정 = 티어 앵커 없음이고, 그 상태로
    // 링크를 그리면 형제 앱 링크가 전부 죽는다. "빈 목록이니 목록만 비워 두자" 로 되돌아가면
    // 현재 서비스 하나뿐인(= 갈 곳 없는) 드롭다운이 생기므로 **컴포넌트째** 사라져야 한다.
    services = [];
    const { container } = render(<ServiceSwitcher />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: '서비스 전환' })).not.toBeInTheDocument();
  });

  it('osHubHref() 가 null 이면 OS 홈 항목만 빠지고 서비스 목록은 남는다', () => {
    // 카탈로그가 목록을 준 이상(= 앵커가 있는 배포) 스위처는 살아야 한다. 허브 URL 정규화만
    // 실패한 경우(형식 오류 등) 항목째 숨긴다 — user-menu 의 '설정' 항목과 동형이고,
    // href="" 로 두면 현재 페이지 리로드로 동작해 더 나쁘다(osHubHref JSDoc).
    hubHref = null;
    render(<ServiceSwitcher />);
    openMenu();
    expect(screen.queryByRole('link', { name: /OS 홈/ })).not.toBeInTheDocument();
    expect(items()).toHaveLength(3);
  });
});

describe('ServiceSwitcher — 키보드·닫기(useDropdown 배선)', () => {
  it('Escape 로 닫히고 포커스가 트리거로 돌아온다', async () => {
    render(<ServiceSwitcher />);
    openMenu();
    await waitFor(() => expect(items()[0]).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: '서비스 전환' })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('바깥을 클릭하면 닫힌다', async () => {
    render(<ServiceSwitcher />);
    openMenu();
    await waitFor(() => expect(items()[0]).toHaveFocus());

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('navigation', { name: '서비스 전환' })).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('열린 상태에서 트리거를 다시 누르면 닫힌다(pointer 경로)', async () => {
    // 훅이 pointerWasOpen 으로 막고 있는 회귀(Codex #70 4차) — 스위처에서도 배선됐는지 확인.
    render(<ServiceSwitcher />);
    openMenu();
    await waitFor(() => expect(items()[0]).toHaveFocus());

    fireEvent.mouseDown(trigger());
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('방향키로 항목을 오간다 — itemSelector 주입이 실제로 물렸는지', async () => {
    // 훅 기본 선택자는 `[role="menuitem"]` 이라, nav+링크인 이 컴포넌트가
    // `a[data-dropdown-item]` 을 넘기지 않으면 방향키가 조용히 죽는다.
    render(<ServiceSwitcher />);
    openMenu();
    const menu = screen.getByRole('navigation', { name: '서비스 전환' });
    await waitFor(() => expect(items()[0]).toHaveFocus());

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(items()[1]).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'End' });
    expect(items()[items().length - 1]).toHaveFocus();

    // 마지막에서 한 번 더 내려가면 처음으로 순환한다.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(items()[0]).toHaveFocus();
  });

  it('닫힌 트리거의 ArrowUp 은 마지막 항목으로 연다(ARIA menu button 규약)', async () => {
    render(<ServiceSwitcher />);
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(items()[items().length - 1]).toHaveFocus());
  });
});
