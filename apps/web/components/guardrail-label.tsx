// 정의 v0.3 §6 가드레일 시각 라벨.
// 결과·면접 화면 상단에 항상 노출. UI 카피 변경 시 정의 §6 재확인 필요.

import { cn } from '@/lib/utils';

type Variant = 'interview' | 'diagnosis' | 'general';

const copy: Record<Variant, { title: string; body: string }> = {
  general: {
    title: 'AI는 방향과 근거만 제공합니다',
    body:
      '정답·대본을 주지 않습니다. 생기부 기재는 학교 교사 영역이며, 본 서비스는 학생 본인이 앞으로 할 활동만 제안합니다.',
  },
  interview: {
    title: '면접 *준비* 팩 — 대본이 아닙니다',
    body:
      '답변 방향·근거·꼬리질문만 제공합니다. 학생이 자신의 언어로 답할 수 있도록 설계되었습니다.',
  },
  diagnosis: {
    title: '생기부 *진단* 가이드 — 개입이 아닙니다',
    body:
      '교사 기재 영역(세특·행특 등) 문구는 제공하지 않습니다. 학생 본인이 앞으로 할 활동만 제안합니다.',
  },
};

export function GuardrailLabel({
  variant = 'general',
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const c = copy[variant];
  return (
    <aside
      role="note"
      className={cn(
        'rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900',
        className
      )}
    >
      <p className="font-semibold">{c.title}</p>
      <p className="mt-1 text-amber-900/80">{c.body}</p>
    </aside>
  );
}
