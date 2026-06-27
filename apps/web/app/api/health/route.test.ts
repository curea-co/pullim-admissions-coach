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

  it('프로덕션 + 구성 완비 → analyzeReady:true, 백엔드는 boolean(원문 미노출)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-x');
    vi.stubEnv('RATE_LIMIT_IP_HEADER', 'x-forwarded-for');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'memory');
    const body = await GET().json();
    expect(body.env).toBe('production');
    expect(body.analyzeReady).toBe(true);
    // 원문 값('memory') 미노출 — boolean만
    expect(body.config.rateLimitBackend).toBe(true);
    expect(JSON.stringify(body)).not.toContain('memory');
  });

  it('리미터가 수용 안 하는 백엔드(upstash, KV 미연결)면 analyzeReady:false — 리미터와 단일 소스 일치', async () => {
    // 현재 리미터는 memory만 수용(fail-closed). health도 같은 판정(rateLimitConfigError)을
    // 써서, 런타임은 500인데 health는 ready라고 거짓 보고하는 불일치를 막는다.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-x');
    vi.stubEnv('RATE_LIMIT_IP_HEADER', 'x-forwarded-for');
    vi.stubEnv('RATE_LIMIT_BACKEND', 'upstash');
    const body = await GET().json();
    expect(body.analyzeReady).toBe(false);
    expect(JSON.stringify(body)).not.toContain('upstash');
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
