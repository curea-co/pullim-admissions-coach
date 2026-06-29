import { describe, it, expect, afterEach, vi } from 'vitest';
import { osLoginHref } from './os-login';

afterEach(() => vi.unstubAllEnvs());

describe('osLoginHref (OS 로그인 redirect + next 복귀)', () => {
  it('NEXT_PUBLIC_OS_URL 설정 시 {OS}/login?next=<returnUrl>', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'http://os.pullim.local:3001');
    expect(osLoginHref('http://os.pullim.local:3007/result/abc')).toBe(
      'http://os.pullim.local:3001/login?next=http%3A%2F%2Fos.pullim.local%3A3007%2Fresult%2Fabc'
    );
  });

  it('trailing slash 있는 base도 정상(/login 합성)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', 'https://os.pullim.ai/');
    expect(osLoginHref('https://admissions.pullim.ai/submit')).toBe(
      'https://os.pullim.ai/login?next=https%3A%2F%2Fadmissions.pullim.ai%2Fsubmit'
    );
  });

  it('NEXT_PUBLIC_OS_URL 미설정 → null(내부 /login 폴백)', () => {
    vi.stubEnv('NEXT_PUBLIC_OS_URL', '');
    expect(osLoginHref('http://x/y')).toBeNull();
  });
});
