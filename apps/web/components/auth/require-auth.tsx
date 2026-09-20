'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { osLoginHref } from '@/lib/auth/os-login';
import { devGateBypassEnabled } from '@/lib/dev-bypass';
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, refresh } = useAuth();
  const router = useRouter(); const pathname = usePathname();
  // 개발용 게이트 우회(lib/dev-bypass.ts ②) — **마운트 후에만** 켠다. 판정이 브라우저 호스트에
  // 달려 있어 서버는 알 수 없으므로, 렌더 중에 부르면 서버('확인 중…')와 클라 첫 렌더(children)가
  // 어긋나 hydration 이 깨진다. 운영에서는 항상 false 라 이 state 는 계속 false 로 남는다.
  const [gateBypass, setGateBypass] = useState(false);
  useEffect(() => { setGateBypass(devGateBypassEnabled()); }, []);
  useEffect(() => {
    // 우회 중에는 미인증이어도 로그인으로 보내지 않는다. state 가 아니라 함수를 다시 부르는 이유는
    // effect 가 클라 전용이라 hydration 제약이 없고, setGateBypass 반영 전에 status 가 먼저
    // 'guest' 로 떨어지는 경합에서도 리다이렉트를 확실히 막기 때문이다.
    if (devGateBypassEnabled()) return;
    // 'guest'(미인증/만료)만 로그인으로. 'error'(서버/네트워크 일시 장애)는 강등하지 않는다.
    // SSO 모드(NEXT_PUBLIC_OS_URL)면 OS 로그인으로 보내 UserMenu와 진입점을 통일, 아니면 내부 /login.
    if (status === 'guest') {
      const sso = osLoginHref(window.location.href);
      if (sso) window.location.assign(sso);
      else router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  // 우회 중이면 인증 판정을 통째로 건너뛴다 — 토큰이 없어 'guest'/'error' 어느 쪽으로 떨어지든
  // 화면은 열려야 하므로 아래 두 분기보다 **앞**에 둔다.
  if (gateBypass) return <>{children}</>;

  // 일시 오류 — 로그아웃시키지 않고 재시도 제공(백엔드 장애 시 강제 로그인 방지).
  if (status === 'error') {
    return (
      <div className="px-6 py-10 text-sm text-ink-600">
        <p className="mb-3">일시적으로 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (status !== 'authed') {
    return <div className="px-6 py-10 text-sm text-ink-500">확인 중…</div>;
  }
  return <>{children}</>;
}
