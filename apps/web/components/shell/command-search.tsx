'use client';

// topbar 검색(⌘K 팔레트) — 트리거 버튼 + 모달 + 전역 단축키를 한 컴포넌트에 담은 **자립형**.
// 통합 담당이 DashboardShell 의 `actions` 슬롯에 <CommandSearch /> 하나만 꽂으면 된다.
//
// 의존성 원칙: 이 앱에는 Radix 도 lucide 도 없다(번들·업그레이드 부담을 지지 않기로 한 상태).
// 그래서 아이콘은 인라인 SVG, 모달·포커스 관리·스크롤 잠금은 직접 구현한다.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { searchShell, type ShellSearchItem } from '@/lib/shell-search';
import { cn } from '@/lib/utils';

/** 입력 중인 요소인지 — 폼에 타이핑하는 도중에 팔레트가 화면을 가로채지 않게 한다. */
function isEditableTarget(node: EventTarget | null): boolean {
  if (!node || typeof node !== 'object' || !('tagName' in node)) return false;
  const el = node as HTMLElement;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // 단축키 표기는 OS 마다 다르다. 서버 렌더에는 navigator 가 없으므로 기본값(Ctrl)으로 그리고
  // 마운트 후 보정한다 — 초기 HTML 이 서버/클라이언트에서 같아야 hydration 이 깨지지 않는다.
  const [isMac, setIsMac] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const uid = useId();
  const titleId = `${uid}-title`;
  const listboxId = `${uid}-listbox`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  const results = useMemo(() => searchShell(query), [query]);
  // active 를 결과 범위 안으로 — state 로 되돌리지 않고 렌더 중 파생값으로 클램프한다
  // (effect 안에서 setState 하면 한 프레임 어긋난 하이라이트가 보인다).
  const activeIndex = results.length ? Math.min(active, results.length - 1) : -1;

  useEffect(() => {
    const ua = navigator.userAgent || '';
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform || ua));
  }, []);

  const openPalette = () => {
    setQuery('');
    setActive(0);
    setOpen(true);
  };

  const closePalette = () => {
    setOpen(false);
    // 포커스 복귀는 즉시 — 모달이 언마운트되며 포커스가 <body> 로 떨어지면 키보드 사용자는
    // 문서 처음부터 다시 Tab 을 눌러야 한다.
    triggerRef.current?.focus();
  };

  // 전역 단축키: 닫혀 있을 때 ⌘K/Ctrl+K 로 열고, 열려 있을 때 Escape 로 닫는다.
  // Escape 를 document 에서 듣는 이유 — 오버레이를 클릭하면 포커스가 모달 밖으로 나가서
  // 모달 onKeyDown 만으로는 못 잡는다.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (open) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closePalette();
        }
        return;
      }
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      e.preventDefault();
      openPalette();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // 열린 동안 배경 스크롤 잠금. 원래 값을 복원해 다른 곳에서 건 잠금과 싸우지 않는다.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 열리면 입력에 포커스(포털 내용은 effect 시점에 이미 DOM 에 붙어 있다).
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  // 방향키로 내려간 항목이 목록 밖으로 나가지 않게 스크롤.
  // jsdom 에는 scrollIntoView 가 없어 옵셔널 호출로 둔다(테스트가 스텁을 강제받지 않게).
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  const go = (item: ShellSearchItem | undefined) => {
    if (!item) return;
    closePalette();
    // next/navigation 의 push — <a href> 하드 내비게이션이면 SPA 상태가 전부 날아간다.
    router.push(item.href);
  };

  const onModalKeyDown = (e: React.KeyboardEvent) => {
    // 한글 IME 조합 중 키(Enter=글자 확정, 방향키=후보 이동)는 팔레트가 가로채면 안 된다.
    if ((e.nativeEvent as KeyboardEvent).isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) =>
        results.length ? (Math.min(a, results.length - 1) + 1) % results.length : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) =>
        results.length
          ? (Math.min(a, results.length - 1) - 1 + results.length) % results.length
          : 0,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[activeIndex]);
    } else if (e.key === 'Tab') {
      // 포커스 트랩: 포커스는 항상 입력에 두고 선택은 aria-activedescendant 로 표현하므로,
      // Tab 으로 모달 밖(배경 페이지)으로 새어 나가지 않게 막는다.
      e.preventDefault();
    }
  };

  const shortcut = isMac ? '⌘K' : 'Ctrl+K';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closePalette() : openPalette())}
        aria-label="검색"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`검색 (${shortcut})`}
        // 치수: 모바일 44px(터치 타깃) → sm 이상 38px. 옆의 프로필 아바타(44 → 36)와
        // 같은 브레이크포인트에서 줄어들어야 한 줄로 나란히 보인다.
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-tertiary)] outline-none transition-colors duration-150 hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 sm:h-[38px] sm:w-[38px]"
      >
        <SearchIcon size={18} />
      </button>

      {/* 포털로 <body> 에 붙인다 — topbar 는 backdrop-blur 를 걸고 있어 fixed 자식의
          컨테이닝 블록이 되어버린다(모달이 헤더 안에 갇힌다). */}
      {open &&
        createPortal(
          <div
            data-testid="command-search-overlay"
            // z-60 은 topbar. 팔레트는 그 위.
            className="fixed inset-0 z-[100] flex items-start justify-center bg-[var(--surface-overlay)] px-4 pt-[10vh] sm:pt-[12vh]"
            onClick={(e) => {
              if (e.target === e.currentTarget) closePalette();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onKeyDown={onModalKeyDown}
              className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)]"
            >
              <h2 id={titleId} className="sr-only">
                화면 검색
              </h2>

              <div className="flex items-center gap-2.5 border-b border-[var(--border-default)] px-4">
                <SearchIcon size={17} className="shrink-0 text-[var(--text-tertiary)]" />
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                  aria-label="화면 검색"
                  placeholder="메뉴·결과 화면 검색"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  // 모바일은 16px(text-base) — iOS Safari 는 16px 미만 입력에 포커스하면 화면을 확대한다.
                  className="h-12 w-full bg-transparent text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] sm:text-sm"
                />
              </div>

              {results.length === 0 ? (
                <p
                  role="status"
                  className="px-4 py-10 text-center text-sm leading-relaxed text-[var(--text-tertiary)]"
                >
                  일치하는 화면이 없어요.
                  <br />
                  메뉴 이름이나 결과 탭 이름으로 검색해 보세요.
                </p>
              ) : (
                <ul
                  ref={listRef}
                  id={listboxId}
                  role="listbox"
                  aria-label="검색 결과"
                  className="max-h-[60vh] overflow-y-auto p-1.5 sm:max-h-[340px]"
                >
                  {results.map((item, i) => {
                    const isActive = i === activeIndex;
                    return (
                      <li
                        key={item.id}
                        id={optionId(i)}
                        role="option"
                        aria-selected={isActive}
                        data-index={i}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(item)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5',
                          isActive && 'bg-[var(--surface-sunken)]',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="block truncate text-xs text-[var(--text-tertiary)]">
                              {item.description}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-[var(--text-tertiary)]">
                          {item.group}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex items-center gap-3 border-t border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-tertiary)]">
                <span className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  이동
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>Enter</Kbd>
                  열기
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>Esc</Kbd>
                  닫기
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-[var(--radius-xs)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-1 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-[var(--text-secondary)]">
      {children}
    </kbd>
  );
}

function SearchIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
