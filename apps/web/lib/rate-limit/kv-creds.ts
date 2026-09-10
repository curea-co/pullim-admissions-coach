// KV(Upstash/Vercel KV) 연결 자격증명 해석 — **단일 소스**.
// index.ts(구성 판정)와 kv-adapter.ts(Redis 생성)가 공유해 한 provider의 *완전한 쌍*만
// 인정한다. url/token을 서로 다른 provider에서 반쪽씩 섞는 잘못된 구성을 배제.
// (@upstash를 import하지 않으므로 index.ts가 정적 import해도 메모리 모드에 KV가 번들되지 않음.)

export function resolveKvCreds(): { url: string; token: string } | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) return { url: upstashUrl, token: upstashToken };

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) return { url: kvUrl, token: kvToken };

  return null; // 완전한 쌍 없음(미설정 또는 provider 혼합 반쪽 설정)
}
