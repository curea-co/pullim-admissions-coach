'use client';

// 앱 내부 엔타이틀먼트 게이트(구매 벽) — 회원플랜: 입시코치는 `admissions` 이용권 보유자만.
// 게이트키퍼 지침: OS 카드 알럿에 의존하지 않고 **앱 내부**에서 강제(URL 직접 진입/deep-link 안전).
// 권위 신호 = `GET /me/entitlements` 의 flags.admissions(pullim-api #348) — authed 확인 후 사전 판정.
// 반드시 RequireAuth 하위에서 쓴다(인증 선행 전제). BE EntitlementGuard 403은 백스톱으로 항상 유효.

import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { PurchaseWall } from './purchase-wall';
import { hasAdmissionsAccess } from '@/lib/admissions-api';

type Access = 'checking' | 'ok' | 'denied' | 'error';

export function RequireAdmissionsAccess({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [access, setAccess] = useState<Access>('checking');

  useEffect(() => {
    if (status !== 'authed') return;
    let alive = true;
    setAccess('checking');
    hasAdmissionsAccess()
      .then((ok) => alive && setAccess(ok ? 'ok' : 'denied'))
      .catch(() => alive && setAccess('error'));
    return () => {
      alive = false;
    };
  }, [status]);

  // 인증은 상위 RequireAuth 소유 — 미인증이면 여기선 아무것도 렌더하지 않는다(상위가 처리).
  if (status !== 'authed') return null;
  if (access === 'denied') return <PurchaseWall />;
  if (access === 'error') {
    return (
      <div className="px-6 py-10 text-sm text-ink-500">
        이용 권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }
  if (access === 'checking') {
    return <div className="px-6 py-10 text-sm text-ink-500">확인 중…</div>;
  }
  return <>{children}</>;
}
