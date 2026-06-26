import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 무거운 server-only 의존성은 모킹: 실 LLM 호출/엔진 로드 없이 라우트 분기만 검증.
vi.mock('@/lib/analyze', () => ({ analyze: vi.fn() }));
vi.mock('@/lib/profile-adapter', () => ({ toAnalysisInput: vi.fn(() => ({ stub: true })) }));
// @anthropic-ai/sdk 실로드 회피 + instanceof 분기 유지용 최소 스텁.
vi.mock('@anthropic-ai/sdk', () => ({ default: { APIError: class APIError extends Error {} } }));

import { POST } from './route';
import { analyze } from '@/lib/analyze';

const analyzeMock = vi.mocked(analyze);

function makeReq(body: unknown, ip: string): Request {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function validPayload(textLen = 30) {
  return {
    schemaVersion: '0.1',
    record: {
      inputType: 'text_paste',
      text: '수학 탐구 활동을 꾸준히 했다. '.repeat(Math.ceil(textLen / 15)).slice(0, textLen),
      maskingApplied: true,
    },
    targetTrack: 'science_engineering',
    currentStanding: { grade: 2, semester: 1, schoolType: 'general' },
    consent: {
      isMinor: true,
      termsAgreed: true,
      privacyPolicyAgreed: true,
      guardianConsentObtained: true,
      consentTimestamp: '2026-06-26T00:00:00.000Z',
    },
  };
}

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  analyzeMock.mockReset();
});

describe('POST /api/analyze', () => {
  it('레이트리밋: 버스트(3/분) 초과 시 429 + Retry-After', async () => {
    const ip = '10.10.0.1';
    // 잘못된 본문이라도 레이트는 파싱 이전에 적용 → 3회 통과(400) 후 429.
    let last: Response | undefined;
    for (let i = 0; i < 4; i++) last = await POST(makeReq('{}', ip));
    expect(last!.status).toBe(429);
    expect(last!.headers.get('Retry-After')).toBeTruthy();
    const body = await last!.json();
    expect(body.retryAfterSec).toBeGreaterThan(0);
  });

  it('입력 길이 초과 시 413', async () => {
    const big = validPayload();
    big.record.text = 'a'.repeat(50_001); // MAX_SAENGBU_CHARS(5만) 초과
    const res = await POST(makeReq(big, '10.10.0.2'));
    expect(res.status).toBe(413);
  });

  it('키 없으면 데모 폴백(demo:true)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeReq(validPayload(), '10.10.0.3'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.demo).toBe(true);
    expect(body.result).toBeDefined();
  });

  it('내부 오류: 일반 메시지 + 500, 상세(err.message) 비노출', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    analyzeMock.mockRejectedValueOnce(new Error('SECRET_INTERNAL_LEAK_xyz'));
    const res = await POST(makeReq(validPayload(), '10.10.0.4'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain('SECRET_INTERNAL_LEAK');
    expect(body.error).toContain('오류가 발생');
  });

  it('스키마 위반 시 400', async () => {
    const res = await POST(makeReq({ bad: 'shape' }, '10.10.0.5'));
    expect(res.status).toBe(400);
  });
});
