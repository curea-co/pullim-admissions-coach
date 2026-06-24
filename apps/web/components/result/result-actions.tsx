'use client';
import { useState } from 'react';
import { saveDiagnosis } from '@/lib/result-store';

export function ResultActions({ track, summary }: { track: string; summary: string }) {
  const [toast, setToast] = useState('');
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2000); }
  return (
    <div data-no-print className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => window.print()}
        className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-200 hover:text-brand-700">
        PDF로 저장
      </button>
      <button type="button" onClick={() => { saveDiagnosis({ track, summary }); flash('내 결과에 저장했어요 ✓'); }}
        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
        내 결과 저장
      </button>
      <button type="button"
        onClick={() => { void navigator.clipboard?.writeText(window.location.href); flash('링크를 복사했어요'); }}
        className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-200 hover:text-brand-700">
        링크 복사
      </button>
      <span className="text-xs text-ink-400">베타: 링크 공유는 곧</span>
      <span aria-live="polite" className="text-xs font-medium text-emerald-600">{toast}</span>
    </div>
  );
}
