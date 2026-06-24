// 정의 v0.3 §6 가드레일 시각 라벨.
// 결과·면접 화면 상단에 항상 노출. UI 카피 변경 시 정의 §6 재확인 필요.
//
// §6 카피 SSOT는 lib/guardrail-copy.ts — 변경 시 그 파일을 수정하고
// guardrail-copy.test.ts 스냅샷 테스트를 통과시켜야 한다.

import { cn } from '@/lib/utils';
import { GUARDRAIL_COPY, type GuardrailVariant } from '@/lib/guardrail-copy';

// re-export for consumers that import the type from here
export type { GuardrailVariant };
export { GUARDRAIL_COPY };

type Variant = GuardrailVariant;

export function GuardrailLabel({
  variant = 'general',
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const c = GUARDRAIL_COPY[variant];
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
