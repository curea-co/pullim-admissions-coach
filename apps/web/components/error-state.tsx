import { cn } from '@/lib/utils';

type Tone = 'warning' | 'error' | 'info';

const styles: Record<Tone, string> = {
  warning: 'border-amber-200 bg-amber-50/70 text-amber-900',
  error: 'border-rose-200 bg-rose-50/70 text-rose-900',
  info: 'border-brand-200 bg-brand-50/70 text-brand-900',
};

export function ErrorState({
  title,
  message,
  tone = 'error',
  className,
}: {
  title: string;
  message: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm leading-relaxed',
        styles[tone],
        className
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 opacity-90">{message}</p>
    </div>
  );
}
