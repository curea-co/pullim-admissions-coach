import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveKvCreds } from './kv-creds';

afterEach(() => vi.unstubAllEnvs());

describe('resolveKvCreds (완전한 쌍만 인정)', () => {
  it('Upstash 완전한 쌍 → 해당 쌍 반환', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://u.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'utok');
    expect(resolveKvCreds()).toEqual({ url: 'https://u.upstash.io', token: 'utok' });
  });

  it('Vercel KV 완전한 쌍 → 해당 쌍 반환(Upstash 없을 때)', () => {
    vi.stubEnv('KV_REST_API_URL', 'https://k.kv');
    vi.stubEnv('KV_REST_API_TOKEN', 'ktok');
    expect(resolveKvCreds()).toEqual({ url: 'https://k.kv', token: 'ktok' });
  });

  it('provider 혼합(Upstash URL + KV TOKEN)은 인정하지 않음 → null', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://u.upstash.io');
    vi.stubEnv('KV_REST_API_TOKEN', 'ktok'); // 반쪽 + 다른 provider 반쪽
    expect(resolveKvCreds()).toBeNull();
  });

  it('아무것도 없으면 null', () => {
    expect(resolveKvCreds()).toBeNull();
  });
});
