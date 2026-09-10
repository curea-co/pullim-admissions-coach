'use client';

// 개발용 엔타이틀먼트 우회가 켜져 있는 동안 **항상 보이는** 경고 배지.
// 우회로 열린 화면은 실제 권한이 아니므로, 진짜 통과와 눈으로 구분되지 않게 두면 안 된다.
// (그래서 배지는 접거나 숨길 수 없고, 해제 버튼만 제공한다.)
//
// z-index: 모바일 하단 탭바가 z-[70](components/ui/os-tabbar.tsx)이라 그 아래인 z-[60] 을 쓰고,
// 모바일에서는 탭바 높이(62px + safe-area)만큼 띄워 겹치지 않게 한다.

export function DevBypassBadge({ onDisable }: { onDisable: () => void }) {
  return (
    <div
      role="status"
      className="fixed bottom-[76px] left-3 z-[60] flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50/95 px-3 py-1.5 text-[11px] leading-none text-amber-900 shadow-sm sm:bottom-4"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5 shrink-0"
      >
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <span className="font-medium">개발 우회 중 · 실 이용권 아님</span>
      <button
        type="button"
        onClick={onDisable}
        className="rounded-full border border-amber-300 px-2 py-1 font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        해제
      </button>
    </div>
  );
}
