'use client';

// 구매 벽 — 회원 플랜: 입시코치는 유료 전용(체험·게스트 없음). 로그인해도 `exam` 미보유면
// 앱을 쓸 수 없다. 게이트키퍼 지침: 접근제어는 **앱 내부**에서 강제(OS 카드 알럿은 보조).
// URL 직접 진입(deep-link)에도 이 벽으로 막는다.
//
// 획득 경로(확정): OS 토스 결제 → billing→auth 로 exam grant → ent_epoch++ → 재진입.
// TODO(P0-8·게이트키퍼/OS): 아래 구매 링크의 정확한 exam 결제 진입 URL 확정
//   (현재는 NEXT_PUBLIC_OS_URL 홈으로 폴백 — OS 스토어/결제 딥링크가 정해지면 교체).

const OS_URL = process.env.NEXT_PUBLIC_OS_URL ?? '';

/** OS 결제(구매) 진입 URL. 미설정/형식오류 시 null → 버튼 대신 "준비 중" 안내. */
function osPurchaseHref(): string | null {
  if (!OS_URL) return null;
  try {
    // 절대 URL 검증(스킴 누락 'os.pullim.ai' 등 방어 — os-login.ts 와 동일 패턴).
    // TODO(P0·OS 소관): admissions 상품 결제 딥링크 확정 시 경로 교체(현재는 OS 홈으로 폴백).
    return new URL(OS_URL).toString();
  } catch {
    return null;
  }
}

export function PurchaseWall({ onRecheck }: { onRecheck?: () => void }) {
  const href = osPurchaseHref();
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-2xl" aria-hidden>
          🔒
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">유료 회원만 이용할 수 있어요</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          입시코치 진단은 <span className="font-medium text-ink-700">입시 이용권</span>을 구매한
          회원만 사용할 수 있습니다. 결제 후 바로 이용할 수 있어요.
        </p>

        {href ? (
          <a
            href={href}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            이용권 구매하기
          </a>
        ) : (
          <p className="mt-6 rounded-xl border border-ink-100 bg-ink-50 px-4 py-2.5 text-sm text-ink-500">
            구매 페이지 준비 중입니다.
          </p>
        )}

        {/* 결제 완료 후 같은 탭 복귀 시 재검증(Codex #59) — 구매 반영되면 통과. */}
        {onRecheck && (
          <button
            type="button"
            onClick={onRecheck}
            className="mt-3 text-sm text-ink-500 underline decoration-ink-200 underline-offset-2 transition hover:text-ink-700"
          >
            구매를 완료했다면 다시 확인
          </button>
        )}
      </div>
    </div>
  );
}
