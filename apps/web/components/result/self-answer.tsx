'use client';
import { useEffect, useRef, useState } from 'react';
import { getAnswer, setAnswer } from '@/lib/result-store';

export function SelfAnswer({ qid }: { qid: string }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { setValue(getAnswer(qid)); }, [qid]);
  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v); setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setAnswer(qid, v); setSaved(true); }, 600);
  }
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        내 답변 써보기
      </dt>
      <p className="mt-1 text-xs text-ink-500">
        AI 정답이 아니라, 답변 방향을 참고해 <strong className="text-ink-700">스스로</strong> 답해보는 칸이에요.
      </p>
      <textarea
        value={value}
        onChange={onChange}
        rows={4}
        placeholder="예: 활동 → 배운 점 → 진로 연결 순으로 내 말로 적어보기"
        className="mt-2 w-full resize-y rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <p className="mt-1 h-4 text-xs text-emerald-600" aria-live="polite">
        {saved ? '저장됨 ✓' : ''}
      </p>
    </div>
  );
}
