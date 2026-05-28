import { cn } from '@/lib/utils';

const steps = [
  { label: '입력', href: '/submit' },
  { label: '동의', href: '/consent' },
  { label: '결과', href: '/result' },
] as const;

type Props = {
  current: 'submit' | 'consent' | 'result';
};

export function StepIndicator({ current }: Props) {
  const currentIndex = steps.findIndex((s) => s.href.endsWith(current));
  return (
    <ol className="flex items-center gap-3 text-sm">
      {steps.map((step, idx) => {
        const state =
          idx < currentIndex ? 'done' : idx === currentIndex ? 'current' : 'todo';
        return (
          <li key={step.label} className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
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
                state === 'current' && 'font-semibold text-ink-900',
                state === 'done' && 'text-ink-700',
                state === 'todo' && 'text-ink-500'
              )}
            >
              {step.label}
            </span>
            {idx < steps.length - 1 && (
              <span className="hidden h-px w-8 bg-ink-100 sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
