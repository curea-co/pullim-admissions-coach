'use client';

// 드롭다운(트리거 + 팝업 메뉴)의 열기/닫기·포커스 동작 훅.
//
// 원래 apps/web/components/auth/user-menu.tsx 안에 인라인으로 있던 로직을 그대로 옮긴 것이다.
// 프로필 메뉴 · 서비스 스위처 · 알림 메뉴가 같은 동작을 필요로 하는데, 세 곳에 각각 다시
// 구현하면 아래 두 회귀를 세 번 만들게 된다:
//
//   - Codex #70 4차: 열린 상태에서 **트리거를 다시 클릭**하면 닫혀야 하는데, 브라우저 실제
//     이벤트 순서(트리거 mousedown → 메뉴 focusout → click)때문에 focusout 이 먼저 닫고
//     click 이 다시 여는 깜빡임이 났다. → `pointerWasOpen` ref 로 해결.
//   - Codex #70 5차: 4차 수정이 트리거를 "메뉴 안쪽"으로 판정하는 방식이었는데, 그 바람에
//     **Shift+Tab 으로 트리거에 되돌아갈 때 닫히지 않는** 회귀가 났다. → focusout 판정 기준을
//     루트가 아니라 **메뉴 엘리먼트**로 되돌리고, 재클릭은 pointer ref 로 분리.
//
// 이 훅은 role 을 강제하지 않는다. 프로필 메뉴는 `role="menu"`/`role="menuitem"` 을 쓰지만
// 서비스 스위처는 `nav` + 링크 목록을 쓸 예정이라, 항목을 고르는 선택자(`itemSelector`)를
// 주입할 수 있고 방향키 로빙 자체를 끌 수도 있게(`roving: false`) 열어 뒀다.
//
// 회귀 고정 테스트: lib/use-dropdown.test.tsx (훅 단독) · lib/user-menu.test.tsx (소비처).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefCallback,
} from 'react';

export interface UseDropdownOptions {
  /**
   * 메뉴 안에서 방향키로 오갈 항목을 고르는 CSS 선택자. 기본값 `'[role="menuitem"]'`.
   * role 을 훅이 강제하지 않기 위해 열어 둔 값 — 예를 들어 `nav` + 링크 목록이라면
   * `'a[data-dropdown-item]'` 처럼 넘긴다.
   */
  itemSelector?: string;
  /**
   * 방향키 로빙 포커스 사용 여부. 기본 `true`.
   *
   * `true`: 닫힌 트리거의 ArrowDown/ArrowUp 으로 열기(각각 첫/마지막 항목) · 열릴 때 항목
   * 자동 포커스 · 메뉴 안 ArrowDown/ArrowUp 순환 + Home/End.
   *
   * `false`: 위 동작을 전부 끄고 브라우저 기본 Tab 이동에 맡긴다. 바깥 클릭·Esc·focusout
   * 으로 닫는 동작은 그대로 유지된다.
   */
  roving?: boolean;
}

export interface UseDropdownResult {
  /** 메뉴가 열려 있는지. 소비처는 이 값으로 팝업을 조건부 렌더한다. */
  open: boolean;
  /** 열림 상태 직접 지정(외부 트리거로 열어야 할 때). */
  setOpen: (open: boolean) => void;
  /** 닫기 — 항목 선택 후처럼 프로그램적으로 닫을 때. 포커스는 옮기지 않는다. */
  close: () => void;
  /** 트리거로 포커스 되돌리기 — 항목 선택 후 키보드 사용자가 길을 잃지 않게. */
  focusTrigger: () => void;
  /**
   * 트리거와 메뉴를 함께 감싸는 래퍼에 스프레드한다. 바깥 클릭 판정 기준이 된다.
   * 붙이지 않아도 동작하지만(트리거·메뉴 자체로 판정 폴백) 붙이는 쪽이 정확하다.
   */
  rootProps: { ref: RefCallback<HTMLElement> };
  /**
   * 트리거 버튼에 스프레드한다. `aria-expanded` 만 훅이 채우고 `aria-haspopup`·`aria-label`·
   * `type`·클래스는 소비처가 정한다(팝업의 role 을 훅이 단정하지 않기 위해).
   */
  triggerProps: {
    ref: RefCallback<HTMLElement>;
    'aria-expanded': boolean;
    onMouseDown: () => void;
    onClick: () => void;
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => void;
  };
  /**
   * 팝업 컨테이너에 스프레드한다. `role`·`aria-label`·클래스는 소비처가 정한다.
   * 항목은 roving tabindex(`tabIndex={-1}`)로 두고 포커스를 훅이 옮긴다.
   */
  menuProps: {
    ref: RefCallback<HTMLElement>;
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => void;
    onBlur: (e: ReactFocusEvent<HTMLElement>) => void;
  };
}

/**
 * 드롭다운 열기/닫기·포커스 동작을 제공한다.
 *
 * ```tsx
 * const { open, close, rootProps, triggerProps, menuProps } = useDropdown();
 * return (
 *   <div {...rootProps} className="relative">
 *     <button {...triggerProps} type="button" aria-haspopup="menu" aria-label="프로필 메뉴 열기" />
 *     {open && (
 *       <div {...menuProps} role="menu" aria-label="프로필">
 *         <a role="menuitem" tabIndex={-1} href="/mypage" onClick={close}>마이페이지</a>
 *       </div>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useDropdown(options: UseDropdownOptions = {}): UseDropdownResult {
  const { itemSelector = '[role="menuitem"]', roving = true } = options;

  const [open, setOpen] = useState(false);
  // 열릴 때 어느 끝으로 포커스할지 — ARIA menu button 규약상 트리거의 ArrowDown 은 첫 항목,
  // **ArrowUp 은 마지막 항목**으로 연다(Codex #70 3차).
  const [openFocus, setOpenFocus] = useState<'first' | 'last'>('first');

  const rootRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  // 트리거를 **마우스로** 눌렀을 때의 직전 open 상태. focusout 이 click 보다 먼저 닫아버리므로,
  // click 토글이 "닫힌 상태"를 보고 다시 열어버리는 것을 막기 위해 눌린 시점의 값을 쓴다.
  // 키보드 활성화(Enter/Space)에는 mousedown 이 없어 null 로 남고, 그때는 현재 상태를 쓴다.
  const pointerWasOpen = useRef<boolean | null>(null);

  // ref 콜백은 렌더마다 새로 만들면 노드가 detach/attach 를 반복하므로 identity 를 고정한다.
  const setRootNode = useCallback<RefCallback<HTMLElement>>((node) => {
    rootRef.current = node;
  }, []);
  const setTriggerNode = useCallback<RefCallback<HTMLElement>>((node) => {
    triggerRef.current = node;
  }, []);
  const setMenuNode = useCallback<RefCallback<HTMLElement>>((node) => {
    menuRef.current = node;
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const focusTrigger = useCallback(() => triggerRef.current?.focus(), []);

  /** 메뉴 안 항목들 — DOM 을 그때그때 읽는다(조건부 렌더로 개수가 바뀌므로). */
  const menuItems = useCallback(
    (): HTMLElement[] =>
      Array.from(menuRef.current?.querySelectorAll<HTMLElement>(itemSelector) ?? []),
    [itemSelector],
  );

  // 바깥 클릭·Esc 로 닫기. Esc 는 트리거로 포커스를 되돌린다(키보드 사용자가 길을 잃지 않게).
  useEffect(() => {
    if (!open) return;
    function isInside(target: Node | null) {
      // rootProps 를 붙였으면 루트 기준(원본 동작). 안 붙였으면 트리거·메뉴로 폴백한다.
      if (rootRef.current) return rootRef.current.contains(target);
      return Boolean(triggerRef.current?.contains(target) || menuRef.current?.contains(target));
    }
    function onPointerDown(e: MouseEvent) {
      if (!isInside(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // 열릴 때 포커스 이동 — 여는 방식에 따라 첫/마지막 항목.
  useEffect(() => {
    if (!open || !roving) return;
    const list = menuItems();
    (openFocus === 'last' ? list[list.length - 1] : list[0])?.focus();
    // menuItems 는 ref 만 읽는 안정 함수 — open/openFocus 변화에만 반응하면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openFocus, roving]);

  // ARIA menu 키보드 규약 — role="menu" 를 선언한 이상 방향키 이동을 제공해야 한다(Codex #70 P2).
  // 항목은 roving tabindex(-1)로 두고 포커스를 프로그램적으로 옮긴다. Tab 은 메뉴를 벗어나는
  // 네이티브 동작 그대로 두되, 벗어나면 메뉴를 닫는다.
  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (!roving) return;
    const items = menuItems();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (e.key) {
      case 'ArrowDown':
        next = current < 0 ? 0 : (current + 1) % items.length;
        break;
      case 'ArrowUp':
        next = current <= 0 ? items.length - 1 : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    items[next]?.focus();
  }

  return {
    open,
    setOpen,
    close,
    focusTrigger,
    rootProps: { ref: setRootNode },
    triggerProps: {
      ref: setTriggerNode,
      'aria-expanded': open,
      onMouseDown: () => {
        pointerWasOpen.current = open;
      },
      onClick: () => {
        // 마우스 경로면 눌린 시점의 값을, 키보드 경로(mousedown 없음)면 현재 값을 기준으로 토글.
        const wasOpen = pointerWasOpen.current ?? open;
        pointerWasOpen.current = null;
        setOpenFocus('first');
        setOpen(!wasOpen);
      },
      onKeyDown: (e) => {
        // 닫힌 상태에서 ArrowDown → 첫 항목, ArrowUp → 마지막 항목(ARIA menu button 규약).
        if (roving && !open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          e.preventDefault();
          setOpenFocus(e.key === 'ArrowUp' ? 'last' : 'first');
          setOpen(true);
        }
      },
    },
    menuProps: {
      ref: setMenuNode,
      onKeyDown: onMenuKeyDown,
      onBlur: (e) => {
        // 포커스가 **메뉴 밖으로** 나가면 닫는다 — Tab·Shift+Tab 모두 포함하며, 트리거로
        // 되돌아가는 Shift+Tab 도 이탈로 본다(Codex #70 5차). 트리거를 마우스로 눌러 닫는
        // 경로는 pointerWasOpen 으로 별도 처리하므로, 여기서 닫혀도 click 이 다시 열지 않는다.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      },
    },
  };
}
