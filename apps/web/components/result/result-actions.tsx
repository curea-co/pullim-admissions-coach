'use client';
import { useState } from 'react';

// 저장 버튼은 2026-09-21 에 내렸다 — saveDiagnosis 가 쓰던 브라우저 로컬 저장소를 읽는 화면이
// 하나도 없었다(읽던 마이페이지는 #103 에서 철수, /result 목록은 서버를 읽는다). "저장했어요 ✓"
// 를 보고도 볼 곳이 없는 버튼이라, 진단이 서버 정본으로 늘 남는다는 사실만 남긴다.
export function ResultActions({ summary }: { summary: string }) {
  const [toast, setToast] = useState('');
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2000); }
  return (
    <div data-no-print className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => window.print()}
        className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-200 hover:text-brand-700">
        PDF로 저장
      </button>
      <button type="button"
        onClick={() => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href)
              .then(() => flash('링크를 복사했어요'))
              .catch(() => flash('복사에 실패했어요'));
          } else {
            flash('이 브라우저에서는 복사가 안 돼요');
          }
        }}
        className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-200 hover:text-brand-700">
        링크 복사
      </button>
      {/* "링크 공유는 곧" 은 지웠다 — 링크 복사는 지금 동작한다. 대신 실제 제약(받는 사람도
          로그인·이용권이 있어야 열린다)을 말한다. */}
      <span className="text-xs text-ink-400">복사한 링크는 본인만 열 수 있어요</span>
      <span aria-live="polite" className="text-xs font-medium text-emerald-600">{toast}</span>
    </div>
  );
}
