// 비보안 컨텍스트(os.pullim.local 등 HTTP·비-localhost)에서도 동작하는 UUID v4.
//
// 왜: `crypto.randomUUID()`는 **secure context(https 또는 localhost)에서만** 정의된다.
// 서브도메인 SSO를 재현하려면 `os.pullim.local`(HTTP) 같은 비보안 컨텍스트에서 앱이 돌아야 하는데,
// 거기서는 `crypto.randomUUID`가 undefined라 "crypto.randomUUID is not a function"으로 가입·진단이 깨졌다.
// `crypto.getRandomValues`는 비보안 컨텍스트에서도 사용 가능하므로 이를 폴백으로 쓴다.

/** RFC 4122 v4 UUID. secure context면 네이티브 `crypto.randomUUID`, 아니면 `getRandomValues` 폴백. */
export function safeRandomUUID(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    // 최후 폴백(테스트/구형 환경) — 충돌 가능성은 있으나 throw 방지가 우선.
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return (
    `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-` +
    `${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
  );
}
