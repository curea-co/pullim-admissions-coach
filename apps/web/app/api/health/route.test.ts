import { describe, it, expect, afterEach, vi } from 'vitest';
import { GET } from './route';

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/health', () => {
  it('항상 200 + ok:true', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.config).toBeDefined();
  });

  it('비밀 값은 노출하지 않고 boolean만', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-super-secret');
    const body = await GET().json();
    expect(body.config.aiKey).toBe(true);
    // 실제 키 문자열이 응답 어디에도 없어야
    expect(JSON.stringify(body)).not.toContain('super-secret');
  });

  it('프로덕션 + 구성 완비 → analyzeReady:true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-x');
    vi.stubEnv('RATE_LIMIT_IP_HEADER', 'x-forwarded-for');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
    const body = await GET().json();
    expect(body.env).toBe('production');
    expect(body.analyzeReady).toBe(true);
  });

  it('프로덕션 + 키 누락 → analyzeReady:false(구성 누락 식별)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('RATE_LIMIT_IP_HEADER', 'x-forwarded-for');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
    const body = await GET().json();
    expect(body.analyzeReady).toBe(false);
    expect(body.config.aiKey).toBe(false);
  });

  it('authBackend는 pullim/mock만 노출', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', 'pullim');
    expect((await GET().json()).config.authBackend).toBe('pullim');
    vi.stubEnv('NEXT_PUBLIC_AUTH_BACKEND', '');
    expect((await GET().json()).config.authBackend).toBe('mock');
  });
});
