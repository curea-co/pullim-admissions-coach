'use client';

// 쿠폰 등록 폼 — 구매 벽과 마이페이지가 **같은 컴포넌트**를 쓴다.
//
// 두 자리에 두는 이유가 다르다: 구매 벽은 막힌 사람이 그 자리에서 푸는 곳이고, 마이페이지는
// 막히기 전에 미리 등록하는 곳이다. 문구만 `tone` 으로 가르고 로직은 하나로 둔다 — 두 벌로
// 나누면 에러 분기 다섯 개가 한쪽에만 고쳐지는 사고가 난다.
//
// mock 모드에서는 렌더하지 않는다(호출부 책임). mock 에는 이용권 개념 자체가 없어
// /billing/* 을 부르면 NEXT_PUBLIC_PULLIM_API 미설정 시 그냥 실패한다.

import { useId, useState } from 'react';
import { redeemCoupon, isValidCouponCode } from '@/lib/coupon-api';
import { clearAdmissionsAccessCache } from '@/lib/admissions-api';
import { markCouponGranted } from '@/lib/coupon-granted-notice';
import { cn } from '@/lib/utils';

type Result =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  // 등록은 됐는데 admissions 가 아닌 경우 — 서버는 200 이지만 입시코치는 계속 막힌다.
  | { kind: 'other-service' }
  | { kind: 'granted' };

export function CouponRedeemForm({
  /** 등록으로 admissions 가 붙었을 때 상위 게이트를 재검증시킨다(구매 벽 → 통과). */
  onGranted,
  /** wall: 구매 벽 안. panel: 마이페이지 카드 안. */
  tone = 'panel',
}: {
  onGranted?: () => void;
  tone?: 'wall' | 'panel';
}) {
  const inputId = useId();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>({ kind: 'idle' });

  // 제출 가능 여부는 **서버와 같은 패턴**으로 앞단에서 본다(왕복 절약). 서버 검증은 그대로 살아 있다.
  const submittable = isValidCouponCode(code) && !pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submittable) return;
    setPending(true);
    setResult({ kind: 'idle' });
    try {
      const outcome = await redeemCoupon(code);
      if (!outcome.ok) {
        setResult({ kind: 'error', message: outcome.message });
        return;
      }
      if (!outcome.admissionsGranted) {
        // 다른 서비스 쿠폰. 여기서 성공으로만 끝내면 "등록됐다는데 왜 안 열리지" 가 된다.
        setResult({ kind: 'other-service' });
        return;
      }
      setResult({ kind: 'granted' });
      setCode('');
      // 성공 확인을 **폼 바깥에** 남긴다. 바로 아래 onGranted() 가 게이트를 재판정시켜
      // 이 컴포넌트(구매 벽이면 벽 전체)를 언마운트하므로, 여기서 띄운 메시지는 화면에
      // 남을 시간이 없다. 등록 후 실제로 렌더되는 화면이 이 신호를 소비해 한 번 보여준다.
      markCouponGranted();
      // 게이트가 세션 캐시를 들고 있어 비우지 않으면 새 grant 를 못 본다(lib/admissions-api.ts).
      clearAdmissionsAccessCache();
      onGranted?.();
    } finally {
      setPending(false);
    }
  }

  const onWall = tone === 'wall';

  return (
    <div className={cn('text-left', onWall && 'mt-6 border-t border-ink-100 pt-5')}>
      <label htmlFor={inputId} className="block text-sm font-semibold text-ink-700">
        쿠폰이 있나요?
      </label>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        발급받은 쿠폰 코드를 입력하면 입시 이용권이 바로 등록됩니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          name="couponCode"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (result.kind !== 'idle') setResult({ kind: 'idle' });
          }}
          placeholder="ABCD-EF23-GHJ4"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={result.kind === 'error' || undefined}
          aria-describedby={result.kind === 'idle' ? undefined : `${inputId}-msg`}
          className="min-w-0 flex-1 rounded-xl border border-ink-200 px-3 py-2 font-mono text-sm tracking-wide text-ink-900 transition placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-300 focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        />
        <button
          type="submit"
          disabled={!submittable}
          className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? '등록 중…' : '등록'}
        </button>
      </form>

      {result.kind !== 'idle' && (
        <p
          id={`${inputId}-msg`}
          role={result.kind === 'granted' ? 'status' : 'alert'}
          className={cn(
            'mt-2 text-xs leading-relaxed',
            result.kind === 'granted' ? 'text-emerald-700' : 'text-rose-600'
          )}
        >
          {result.kind === 'granted' && '이용권이 등록됐어요. 이제 진단을 시작할 수 있어요.'}
          {/* 다른 서비스 쿠폰 — 실패가 아니라서 톤을 낮추되, 입시코치는 안 열린다고 분명히 말한다. */}
          {result.kind === 'other-service' && (
            <span className="text-amber-700">
              쿠폰은 등록됐지만 입시 이용권은 아니에요. 다른 풀림 서비스에서 확인해 주세요.
            </span>
          )}
          {result.kind === 'error' && result.message}
        </p>
      )}
    </div>
  );
}
