import { describe, it, expect, afterEach, vi } from 'vitest';
import { osLoginHref } from './os-login';

afterEach(() => vi.unstubAllEnvs());

describe('osLoginHref (OS 로그인 redirect + next 복귀)', () => {
  it('NEXT_PUBLIC_OS_URL 설정 시 {OS}/login?next=<returnUrl>', () => {
    // base = apex(로그인 페이지 호스트). os.* 는 OS 셸이라 /login 404 — .env.local.example 참고.
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'http://pullim.local:3001');
    expect(osLoginHref('http://os.pullim.local:3007/result/abc')).toBe(
      'http://pullim.local:3001/login?next=http%3A%2F%2Fos.pullim.local%3A3007%2Fresult%2Fabc'
    );
  });

  it('trailing slash 있는 base도 정상(/login 합성)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://pullim.ai/');
    expect(osLoginHref('https://admissions.pullim.ai/submit')).toBe(
      'https://pullim.ai/login?next=https%3A%2F%2Fadmissions.pullim.ai%2Fsubmit'
    );
  });

  it('NEXT_PUBLIC_OS_URL 미설정 → null(내부 /login 폴백)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', '');
    expect(osLoginHref('http://x/y')).toBeNull();
  });

  it('NEXT_PUBLIC_OS_URL 형식 오류(스킴 누락) → null(throw 안 하고 폴백)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'os.pullim.ai'); // 스킴 없음 → new URL throw
    expect(osLoginHref('http://x/y')).toBeNull();
  });
});
