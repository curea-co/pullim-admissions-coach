'use client';

// 앱 내부 엔타이틀먼트 게이트(구매 벽) — 회원플랜: 입시코치는 `admissions` 이용권 보유자만.
// 게이트키퍼 지침: OS 카드 알럿에 의존하지 않고 **앱 내부**에서 강제(URL 직접 진입/deep-link 안전).
// 권위 신호 = `GET /me/entitlements` 의 flags.admissions(pullim-api #348) — authed 확인 후 사전 판정.
// 반드시 RequireAuth 하위에서 쓴다(인증 선행 전제). BE EntitlementGuard 403은 백스톱으로 항상 유효.

import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { PurchaseWall } from './purchase-wall';
import { hasAdmissionsAccess } from '@/lib/admissions-api';
import type { ApiError } from '@/lib/api';

type Access = 'checking' | 'ok' | 'denied' | 'error';

export function RequireAdmissionsAccess({ children }: { children: React.ReactNode }) {
  const { status, refresh } = useAuth();
  const [access, setAccess] = useState<Access>('checking');
  // 재검증 트리거(Codex #59) — 결제 완료 후 같은 탭 복귀(denied) 또는 일시 오류(error)에서 재확인.
  const [nonce, setNonce] = useState(0);
  const recheck = () => setNonce((n) => n + 1);

  useEffect(() => {
    if (status !== 'authed') return;
    let alive = true;
    setAccess('checking');
    hasAdmissionsAccess()
      .then((ok) => alive && setAccess(ok ? 'ok' : 'denied'))
      .catch((err: ApiError) => {
        if (!alive) return;
        // 세션 만료(401 + refresh 실패)는 재인증 대상 — error 로 뭉뚱그리지 않고 refresh() 로 넘긴다
        // (status→guest 시 상위 RequireAuth 가 OS 로그인 redirect). 일시 장애만 error.
        if (err?.authExpired || err?.status === 401) {
          void refresh();
          return;
        }
        setAccess('error');
      });
    return () => {
      alive = false;
    };
  }, [status, refresh, nonce]);

  if (status !== 'authed') return null;
  // 결제 완료 후 같은 탭 복귀 시 "다시 확인"으로 재검증 → 구매 반영되면 통과(구매 벽에 갇히지 않음).
  if (access === 'denied') return <PurchaseWall onRecheck={recheck} />;
  // 일시 장애(5xx/네트워크) — 유효 유료 사용자가 갇히지 않게 재시도 버튼 제공.
  if (access === 'error') {
    return (
      <div className="px-6 py-10 text-sm text-ink-600">
        <p className="mb-3">이용 권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={recheck}
          className="rounded-xl border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (access === 'checking') {
    return <div className="px-6 py-10 text-sm text-ink-500">확인 중…</div>;
  }
  return <>{children}</>;
}
