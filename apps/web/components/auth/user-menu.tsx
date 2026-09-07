'use client';

// topbar 우측(DashboardShell 의 actions 슬롯) — PUDS 소비 앱 공통 규격.
//
// 규격 출처: PUDS 는 셸 뼈대(DashboardShell/OsRail/OsTabbar)만 배포하고 actions 슬롯의 내용물은
// 정의하지 않는다. 프로필 표시는 pullim-web(OS) OsTopbar 를 원본으로 pullim-Q · pullim-planner ·
// pullim-writing-coach 세 앱이 동일하게 수렴한 패턴을 따른다:
//   - 트리거 = 원형 그라디언트 아바타(이니셜 1글자, 데스크탑 36px · 모바일 44px 터치 타깃)
//   - 로그아웃은 **topbar 에 노출하지 않고** 드롭다운 안에만 둔다(직전 구현은 topbar 나열이라 규격 위반)
//   - 메뉴 순서 고정: 이름+플랜 배지 → "로그인됨" → 설정(OS 위임) → 로그아웃
//   - 메뉴 항목에 아이콘을 달지 않는다(OS 원본이 텍스트만 — 같은 메뉴가 서로 달라 보이는 것 방지)
//   - 로그아웃은 destructive(빨강) 아닌 본문 잉크색(OS QA #91/#92 확정)
//
// 색·간격은 셸(DashboardShell/OsRail)과 같은 PUDS 시맨틱 토큰을 쓴다. 아바타 그라디언트만
// OS 원본 값(#1F89F5 → #004BB9)을 그대로 옮긴다 — 서비스 간 아바타가 같아 보여야 하므로.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { hasAdmissionsAccess } from '@/lib/admissions-api';
import { isPullimAuth, type User } from '@/lib/auth';
import { osLoginHref, osSettingsHref, osSignupHref } from '@/lib/auth/os-login';
import { cn } from '@/lib/utils';

const LOGIN_CTA_CLASS =
  'rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700';

const MENU_ITEM_CLASS =
  'flex w-full items-center px-3 py-2 text-left text-sm text-[var(--text-primary)] outline-none transition hover:bg-[var(--color-action-secondary)] focus-visible:bg-[var(--color-action-secondary)] disabled:cursor-not-allowed disabled:opacity-60';

/** 아바타 — 데스크탑 36px, 모바일 44px(터치 타깃). 그라디언트는 OS 원본 값 고정. */
const AVATAR_CLASS =
  'inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1F89F5] to-[#004BB9] text-sm font-bold text-white shadow-[var(--shadow-sm)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 sm:h-9 sm:w-9';

export function UserMenu({ className }: { className?: string }) {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return (
      <div className={cn('flex items-center', className)} aria-busy="true">
        <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--color-action-secondary)] sm:h-9 sm:w-9" />
      </div>
    );
  }

  if (status === 'authed' && user) {
    // key=user.id — 같은 탭 사용자 전환(A→B) 시 메뉴 로컬 상태(플랜 배지)를 새로 시작.
    return <ProfileMenu key={user.id} user={user} className={className} />;
  }

  // 일시 오류(/me 일시 실패) — 로그아웃이 아니므로 로그인/가입 CTA를 띄우지 않는다.
  if (status === 'error') {
    return (
      <div className={cn('flex items-center', className)}>
        <span className="text-xs text-ink-400">일시 오류</span>
      </div>
    );
  }

  // guest — NEXT_PUBLIC_OS_URL 설정 시 OS 로그인으로 SSO redirect(돌아올 URL을 next로),
  // 미설정 시 내부 /login(mock) 폴백.
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {process.env.NEXT_PUBLIC_OS_URL ? (
        <button
          type="button"
          onClick={() => window.location.assign(osLoginHref(window.location.href) ?? '/login')}
          className={LOGIN_CTA_CLASS}
        >
          로그인
        </button>
      ) : (
        <Link href="/login" className={LOGIN_CTA_CLASS}>
          로그인
        </Link>
      )}
      {process.env.NEXT_PUBLIC_OS_URL ? (
        <button
          type="button"
          onClick={() => window.location.assign(osSignupHref(window.location.href) ?? '/signup')}
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          가입
        </button>
      ) : (
        <Link
          href="/signup"
          className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          가입
        </Link>
      )}
    </div>
  );
}

/** 플랜 배지 — 'idle'(미조회)·조회 실패는 **배지를 숨긴다**(플랜을 함부로 단정하지 않음). */
type Plan = 'idle' | 'has' | 'none';

function ProfileMenu({ user, className }: { user: User; className?: string }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan>('idle');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭·Esc 로 닫기. Esc 는 트리거로 포커스를 되돌린다(키보드 사용자가 길을 잃지 않게).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  // 열릴 때 첫 항목으로 포커스 이동(메뉴 표준 동작).
  useEffect(() => {
    if (!open) return;
    menuItems()[0]?.focus();
    // menuItems 는 ref 만 읽는 안정 함수 — open 변화에만 반응하면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function menuItems(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  // ARIA menu 키보드 규약 — role="menu" 를 선언한 이상 방향키 이동을 제공해야 한다(Codex #70 P2).
  // 항목은 roving tabindex(-1)로 두고 포커스를 프로그램적으로 옮긴다. Tab 은 메뉴를 벗어나는
  // 네이티브 동작 그대로 두되, 벗어나면 메뉴를 닫는다.
  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
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

  // 플랜 배지 — **열 때 1회만** 조회(모든 페이지 로드마다 /me/entitlements 를 치지 않는다).
  // 실 auth 모드에서만. 실패는 조용히 무시하고 배지를 숨긴 채 둔다(게이트가 아니라 표시일 뿐).
  useEffect(() => {
    if (!open || !isPullimAuth || plan !== 'idle') return;
    let alive = true;
    hasAdmissionsAccess()
      .then((ok) => {
        if (alive) setPlan(ok ? 'has' : 'none');
      })
      .catch(() => {
        /* 조회 실패 — 'idle' 유지(배지 숨김). 판정은 게이트(RequireAdmissionsAccess)가 한다. */
      });
    return () => {
      alive = false;
    };
  }, [open, plan]);

  async function handleLogout() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await logout();
      // **서버 로그아웃이 끝난 뒤에만** 이동한다 — 실패했는데 로그아웃된 줄 알고 자리를 뜨는
      // 사고 방지(세 소비 앱 공통 규칙). OS 미설정(mock)이면 내부 /login 폴백.
      window.location.assign(osLoginHref(window.location.origin) ?? '/login');
    } catch {
      setPending(false);
      setError('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  const displayName = user.displayName?.trim() ?? '';
  const initial = displayName ? displayName[0] : null;
  const settingsHref = osSettingsHref();
  const planLabel = plan === 'has' ? '입시 이용권 보유' : plan === 'none' ? '이용권 미보유' : null;

  return (
    <div ref={rootRef} className={cn('relative flex items-center', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="프로필 메뉴 열기"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          // 닫힌 상태에서 ArrowDown → 열고 첫 항목으로(메뉴 표준 동작).
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={AVATAR_CLASS}
      >
        {initial ?? <IconUser className="h-4 w-4" />}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="프로필"
          onKeyDown={onMenuKeyDown}
          onBlur={(e) => {
            // Tab 으로 메뉴 밖으로 나가면 닫는다(포커스가 메뉴 안에 남아 있으면 유지).
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
          className="absolute right-0 top-full z-50 mt-2 min-w-[16rem] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-lg)]"
        >
          <div className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold text-[var(--text-primary)]">
                {displayName || '사용자'}
              </span>
              {planLabel && (
                <span className="shrink-0 rounded-full bg-[var(--color-action-secondary)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                  {planLabel}
                </span>
              )}
            </div>
            {/* 이메일은 노출하지 않는다(OS 원본 동일) */}
            <p className="mt-0.5 text-xs font-medium text-[var(--text-tertiary)]">로그인됨</p>
          </div>

          <MenuSeparator />

          <Link
            role="menuitem"
            tabIndex={-1}
            href="/mypage"
            onClick={() => setOpen(false)}
            className={MENU_ITEM_CLASS}
          >
            마이페이지
          </Link>

          {/* 설정은 앱이 소유하지 않고 OS 가 정본 — 미설정 환경에서는 항목째 숨긴다. */}
          {settingsHref && (
            <a role="menuitem" tabIndex={-1} href={settingsHref} className={MENU_ITEM_CLASS}>
              설정
            </a>
          )}

          <MenuSeparator />

          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={() => void handleLogout()}
            disabled={pending}
            className={MENU_ITEM_CLASS}
          >
            {pending ? '로그아웃 중…' : '로그아웃'}
          </button>

          {error && (
            <p role="alert" className="px-3 pb-1.5 pt-1 text-xs text-[var(--text-danger)]">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-[var(--border-subtle)]" />;
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
