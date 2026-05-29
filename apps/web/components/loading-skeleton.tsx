import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse rounded-md bg-ink-100', className)}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="mt-3 h-5 w-3/5" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}
