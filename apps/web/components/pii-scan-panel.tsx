'use client';

import type { PiiMatch } from '@pullim/shared';
import { cn } from '@/lib/utils';

const CATEGORY_LABEL: Record<string, string> = {
  phone: '전화', rrn: '주민번호', email: '이메일', school: '학교명',
  name: '이름', teacher: '교사', birth_date: '생년월일', address: '주소',
};

function summarize(matches: PiiMatch[]) {
  const counts = new Map<string, number>();
  for (const m of matches) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  return [...counts.entries()].map(([cat, n]) => `${CATEGORY_LABEL[cat] ?? cat} ${n}`);
}

export function PiiScanPanel({
  matches,
  onAutoRedact,
  hasText,
  scanned,
}: {
  matches: PiiMatch[];
  onAutoRedact: () => void;
  hasText: boolean;
  scanned: boolean;
}) {
  if (!hasText) {
    return null;
  }
  if (!scanned) {
    return (
      <div className="mt-3 rounded-xl border border-ink-100 bg-ink-100/40 px-4 py-3 text-sm text-ink-500">
        식별정보 검사 중…
      </div>
    );
  }
  if (matches.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-sm text-emerald-800">
        식별정보로 보이는 항목이 없어요.
      </div>
    );
  }
  const block = matches.filter((m) => m.tier === 'block');
  const warn = matches.filter((m) => m.tier === 'warn');
  return (
    <div
      className={cn(
        'mt-3 rounded-xl border px-4 py-3 text-sm',
        block.length ? 'border-rose-200 bg-rose-50/50' : 'border-amber-200 bg-amber-50/50'
      )}
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink-900">
          {block.length > 0
            ? `반드시 가려야 할 식별정보 ${block.length}건`
            : `확인이 필요한 항목 ${warn.length}건`}
        </p>
        <button
          type="button"
          onClick={onAutoRedact}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          자동 가림
        </button>
      </div>
      {block.length > 0 && (
        <p className="mt-1.5 text-xs text-rose-700">
          {summarize(block).join(' · ')} — 가리기 전에는 제출할 수 없어요.
        </p>
      )}
      {warn.length > 0 && (
        <p className="mt-1.5 text-xs text-amber-700">
          {summarize(warn).join(' · ')} — 이름·교사로 보이는 항목이에요.{' '}
          {/* 아래 확인란(submit/page.tsx)은 **차단 항목이 없을 때만** 그려진다. 둘 다 잡힌
              상태에서 "아래에서 확인" 이라고 하면 없는 컨트롤을 가리키게 된다 — 그때는
              다음에 할 일(가리기)만 말한다. */}
          {block.length > 0
            ? '[자동 가림]을 누르면 함께 가려져요.'
            : '[자동 가림]을 누르거나, 식별정보가 아니면 아래 확인란에 체크하고 진행하세요.'}
        </p>
      )}
    </div>
  );
}
