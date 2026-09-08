'use client';

// topbar 알림 — **창구만** 연다. 데이터 소스는 아직 붙이지 않는다.
//
// 자립형: 통합 담당이 DashboardShell 의 `actions` 슬롯에 <NotificationsMenu /> 하나만 꽂으면 된다.
//
// ── 왜 "미읽음 점 배지"가 없나 (지우지 말 것) ───────────────────────────────────────
// 알림 발송 인프라가 아직 없어서 실제 미읽음은 **언제나 0** 이다. 그 상태에서 빨간 점을 그리면
// "안 읽은 알림이 있다"는 거짓 신호가 된다. pullim-planner 는 같은 배지를 넣었다가 이 이유로
// 의도적으로 제거했고, pullim-Q 도 빈 상태만 노출한다. 이 저장소 정의 §6(정직성 가드레일)과
// 같은 원칙 — 없는 것을 있는 것처럼 보이게 하지 않는다.
//
// 항상 0인 변수로 `unread > 0 && <점/>` 같은 죽은 분기를 남겨 두는 것도 하지 않는다. 그런 코드는
// "곧 켜질 기능"처럼 보여서 다음 사람이 잘못 판단한다. 배선 지점은 코드가 아니라 이 주석이다.
// 회귀 고정: lib/notifications-menu.test.tsx 의 "점 배지가 DOM 에 없다" 테스트.
//
// ── 후속 배선 지점 ──────────────────────────────────────────────────────────────
// 이 앱의 진단은 24시간 SLA 비동기 작업이라(정의 §8) 학생이 제출 후 완료를 기다린다.
// 그래서 **"진단이 끝났어요"가 이 앱의 첫 알림**이 될 자리다. 소스 후보 두 가지:
//   1) 진단 상태 전이(pending → done) — result-store / 제출 상태머신을 구독
//   2) 백엔드 `/me/notifications` — 풀림 OS 가 이미 쓰는 계약
// 목록이 생기면 아래 EmptyState 자리에 <ul> 을 렌더하고, 그때 roving 판단(아래)도 다시 본다.

import { useCallback, useEffect, useId, useRef } from 'react';
import { useDropdown } from '@/lib/use-dropdown';
import { cn } from '@/lib/utils';

/**
 * 트리거 치수 — topbar 우측 액션들과 한 줄 정렬. 검색 버튼(components/shell/command-search.tsx)과
 * **같은 클래스**를 쓴다(모바일 44px 터치 타깃 / sm 이상 38px / rounded-[11px]). 프로필 아바타는
 * 36px 원형이지만 60px 바 안에서 세로 중앙 정렬이라 2px 차이는 눈에 띄지 않는다.
 */
const TRIGGER_CLASS =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-tertiary)] outline-none transition-colors duration-150 hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 sm:h-[38px] sm:w-[38px]';

/**
 * 패널 위치·치수.
 *
 * 모바일: 폭 320px 를 트리거 기준 우측 정렬하면 좁은 화면(320~375px)에서 왼쪽이 잘린다.
 *   → 라이팅코치 서비스 스위처와 같은 해법으로 viewport 고정(`fixed inset-x-3`, 헤더 60px 아래
 *     8px)해 전폭으로 편다. topbar 헤더에 `backdrop-blur` 가 있어 fixed 의 컨테이닝 블록이
 *     헤더의 padding box 가 되지만, 헤더가 `sticky top-0` 전폭이라 결과 좌표는 viewport 기준과
 *     같다(헤더에서 blur 가 빠져도 동작이 바뀌지 않는다).
 * sm 이상: 트리거 아래 우측 정렬 320px.
 *
 * 높이: 모바일 하단 탭바(h-[62px+safe-area], z-[70])를 절대 덮지 않도록 남겨 둔다. 헤더가
 * `z-[60]` + backdrop-filter 로 **자체 스택 컨텍스트**를 만들기 때문에, 그 안에 있는 이 패널은
 * z-index 를 아무리 올려도 탭바 위로 그려질 수 없다. 그래서 z-[80] 은 topbar 내부 형제들보다
 * 위라는 의미만 갖고, 탭바와의 충돌은 **겹치지 않게 잘라서** 해결한다.
 */
const PANEL_CLASS =
  'fixed inset-x-3 top-[68px] z-[80] max-h-[calc(100dvh_-_68px_-_70px_-_env(safe-area-inset-bottom))] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)] outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[60vh] sm:w-80';

export function NotificationsMenu({ className }: { className?: string }) {
  // 열기/닫기·바깥 클릭·Esc·포커스 복귀는 useDropdown 이 소유한다(lib/use-dropdown.ts).
  // 직접 다시 구현하면 프로필 메뉴가 Codex #70 3~5차에 걸쳐 고친 회귀를 그대로 재현하게 된다.
  //
  // roving: false 인 이유 — 지금 패널은 **읽을거리**이지 명령 목록이 아니다. 항목이 0개라
  // 방향키로 옮길 대상이 없고, role="menu" 도 선언하지 않으므로 ARIA menu 키보드 규약
  // (방향키·Home/End)을 제공할 의무가 없다. roving 을 켜 두면 닫힌 트리거의 ArrowDown 이
  // "메뉴 버튼"처럼 열리는데 정작 포커스 갈 항목이 없어, 열렸다고만 알리고 아무 데도 못 가는
  // 상태가 된다. 알림 목록이 생기면: 항목이 **행위**(읽음 처리 등)면 role="menu"+menuitem 으로
  // roving 을 켜고, 단순 링크 목록이면 itemSelector 를 주입해서 켠다.
  const { open, rootProps, triggerProps, menuProps } = useDropdown({ roving: false });

  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  // 훅의 메뉴 ref 와 포커스용 panelRef 를 한 노드에 붙인다. ref 콜백은 identity 를 고정해야
  // 한다 — 렌더마다 새로 만들면 React 가 노드를 detach/attach 하며 훅의 menuRef 가 잠시 null 이
  // 된다. menuProps.ref 는 훅 안에서 useCallback 으로 고정돼 있어 이 의존성은 안정적이다.
  const menuRefCallback = menuProps.ref;
  const setPanelNode = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      menuRefCallback(node);
    },
    [menuRefCallback],
  );

  // 열릴 때 패널로 포커스를 옮긴다. roving 을 껐으므로 훅은 포커스를 옮기지 않는데, 그대로 두면
  // (1) 스크린리더 사용자에게 패널 내용이 읽히지 않고 (2) 포커스가 패널에 들어간 적이 없어
  // Tab 으로 빠져나가도 menuProps.onBlur 가 안 걸려 패널이 열린 채 남는다. 포커스 링은
  // outline-none(PANEL_CLASS)으로 숨긴다 — 마우스 사용자에게 보일 이유가 없다.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div {...rootProps} className={cn('relative flex items-center', className)}>
      <button
        {...triggerProps}
        type="button"
        // role="menu" 가 아니라 팝오버(dialog) 이므로 haspopup 도 dialog.
        aria-haspopup="dialog"
        // 미읽음 수를 라벨에 넣지 않는다 — 항상 0인데 "알림 0건"이라고 읽어 주면 소음이다.
        aria-label="알림"
        className={TRIGGER_CLASS}
      >
        {/* 종 아이콘 — dev-os OsTopbar / pullim-Q 와 같은 path(서비스 간 아이콘이 달라 보이지 않게).
            lucide 등 아이콘 의존성을 추가하지 않는 것이 이 앱의 방침이라 인라인 SVG. */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </button>

      {open && (
        <div
          {...menuProps}
          ref={setPanelNode}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={PANEL_CLASS}
        >
          <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
            <h2 id={titleId} className="text-sm font-bold text-[var(--text-primary)]">
              알림
            </h2>
          </div>

          {/* 후속: 알림이 생기면 이 자리에 <ul> 목록을 렌더한다(파일 상단 "후속 배선 지점" 참고). */}
          <EmptyState />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
      <IconBellOff className="h-6 w-6 text-[var(--text-tertiary)]" />
      <p className="text-sm font-semibold text-[var(--text-secondary)]">받은 알림이 없어요</p>
      <p className="text-sm leading-[1.6] text-[var(--text-tertiary)]">
        중요한 소식이 생기면 여기로 알려드릴게요.
      </p>
    </div>
  );
}

/** 빈 상태용 종 아이콘 변형 — 사선을 그어 "알림 없음"을 시각적으로 구분한다. */
function IconBellOff({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

