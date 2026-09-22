'use client';

// 쿠폰 등록 성공 확인 — 등록 **직후 렌더되는 화면**에서 한 번 뜬다.
// 신호와 그 이유는 lib/coupon-granted-notice.ts 주석 참조.

import { useEffect, useState } from 'react';
import { consumeCouponGranted } from '@/lib/coupon-granted-notice';

export function CouponGrantedNotice({ className }: { className?: string }) {
  // sessionStorage 는 **마운트 후에만** 읽는다 — 서버 렌더에는 없는 값이라
  // 첫 렌더에서 읽으면 hydration 이 어긋난다.
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(consumeCouponGranted());
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className={
        'mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 ' +
        (className ?? '')
      }
    >
      <p className="leading-relaxed">
        <span className="font-semibold">이용권이 등록됐어요.</span> 이제 생기부를 제출하면 진단을
        받을 수 있어요.
      </p>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="알림 닫기"
        className="shrink-0 rounded px-1 text-emerald-700/70 transition hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        ✕
      </button>
    </div>
  );
}
