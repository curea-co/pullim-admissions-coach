import { cn } from '@/lib/utils';

const steps = [
  { label: '입력', key: 'submit' },
  { label: '동의', key: 'consent' },
  { label: '처리', key: 'processing' },
  { label: '결과', key: 'result' },
] as const;

type StepKey = (typeof steps)[number]['key'];

export function StepIndicator({ current }: { current: StepKey }) {
  const currentIndex = steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 text-sm sm:gap-3">
      {steps.map((step, idx) => {
        const state =
          idx < currentIndex ? 'done' : idx === currentIndex ? 'current' : 'todo';
        return (
          <li key={step.key} className="flex items-center gap-2 sm:gap-3">
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-xs font-semibold transition',
                state === 'current' && 'bg-brand-600 text-white',
                state === 'done' && 'bg-brand-100 text-brand-700',
                state === 'todo' && 'bg-ink-100 text-ink-500'
              )}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {idx + 1}
            </span>
            <span
              className={cn(
                'hidden sm:inline',
                state === 'current' && 'font-semibold text-ink-900',
                state === 'done' && 'text-ink-700',
                state === 'todo' && 'text-ink-500'
              )}
            >
              {step.label}
            </span>
            {idx < steps.length - 1 && (
              <span className="hidden h-px w-6 bg-ink-100 sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
