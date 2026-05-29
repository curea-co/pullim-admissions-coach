import { cn } from '@/lib/utils';

// 빈 상태 placeholder. 결과 미도착·검수 큐 빈 상태·자녀 미연결 학부모 화면 등
// Phase C/D에서 실제 데이터 미존재 시 사용. 현재는 시각 셸에 미배치.

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-100 bg-white px-6 py-12 text-center',
        className
      )}
    >
      <span aria-hidden className="text-3xl text-ink-300">
        ∅
      </span>
      <p className="mt-4 text-base font-semibold text-ink-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-ink-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
