'use client';

// 앱 내부 엔타이틀먼트 게이트(구매 벽) — 회원플랜: 입시코치는 `admissions` 이용권 보유자만.
// 게이트키퍼 지침: OS 카드 알럿에 의존하지 않고 **앱 내부**에서 강제(URL 직접 진입/deep-link 안전).
// 권위 신호 = `GET /me/entitlements` 의 flags.admissions(pullim-api #348) — authed 확인 후 사전 판정.
// 반드시 RequireAuth 하위에서 쓴다(인증 선행 전제). BE EntitlementGuard 403은 백스톱으로 항상 유효.

import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { PurchaseWall } from './purchase-wall';
import { hasAdmissionsAccess } from '@/lib/admissions-api';
import { isPullimAuth } from '@/lib/auth';
import type { ApiError } from '@/lib/api';

type Access = 'checking' | 'ok' | 'denied' | 'error';

export function RequireAdmissionsAccess({ children }: { children: React.ReactNode }) {
  const { status, refresh } = useAuth();
  // mock/데모 모드(비실 auth)에는 엔타이틀먼트/구매 벽 개념이 없다 — 게이트 무효화(통과).
  // 실 auth(NEXT_PUBLIC_AUTH_BACKEND=pullim)에서만 /me/entitlements 로 판정(Codex #59):
  // mock 모드에서 실 API 를 호출하면 NEXT_PUBLIC_PULLIM_API 미설정 시 전 페이지가 막힌다.
  const [access, setAccess] = useState<Access>(() => (isPullimAuth ? 'checking' : 'ok'));
  // 재검증 트리거(Codex #59) — 결제 완료 후 같은 탭 복귀(denied) 또는 일시 오류(error)에서 재확인.
  const [nonce, setNonce] = useState(0);
  const recheck = () => setNonce((n) => n + 1);

  useEffect(() => {
    if (!isPullimAuth) return; // mock/데모: 초기값 'ok' 유지(통과)
    if (status !== 'authed') return;
    let alive = true;
    setAccess('checking');
    hasAdmissionsAccess()
      .then((ok) => alive && setAccess(ok ? 'ok' : 'denied'))
      .catch((err: ApiError) => {
        if (!alive) return;
        // 401(세션 만료)은 error 로 뭉뚱그리지 않고 세션 갱신 시도 후 **재검증**한다:
        //  · 갱신 성공(status 'authed' 유지) → nonce++ 로 effect 재실행해 재확인('checking' 에 갇히지 않음)
        //  · 갱신 실패 → auth-provider 가 status→guest 로 내려 상위 RequireAuth 가 OS 로그인 redirect
        if (err?.authExpired || err?.status === 401) {
          void refresh().finally(() => alive && setNonce((n) => n + 1));
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
