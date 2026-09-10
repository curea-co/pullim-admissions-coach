// 서버가 **바깥으로 보내는** 요청의 목적지 검증 — SSRF 방어.
//
// 공개 라우트(app/api/feedback)가 운영자 설정값(FEEDBACK_WEBHOOK_URL)으로 요청을 보내므로,
// 그 값이 잘못 설정되거나 주입되면 서버가 내부망을 향한 통로가 된다. `new URL()` 이 통과시키는
// 것과 "보내도 되는 주소"는 다르다 — http·file 스킴, 루프백·사설·링크로컬 주소가 전부 유효한
// URL 이다. 판정을 순수 함수로 떼어 주소 표기별로 단독 테스트한다.
//
// ⚠️ 한계: DNS 리바인딩(공인 도메인이 사설 IP 로 해석되는 경우)은 이름만 보는 이 계층에서 막을 수
// 없다. 최종 방어는 설정값 관리(+ 필요하면 이그레스 방화벽)다.

/** IPv4 점표기 → 옥텟. 형식이 아니면 null. */
function parseIpv4(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n <= 255) ? parts : null;
}

/**
 * IPv6 → 8개 hextet. `::` 축약과 끝의 IPv4 점표기(`::ffff:127.0.0.1`)를 모두 편다.
 * URL 파서는 `::ffff:127.0.0.1` 을 `::ffff:7f00:1` 로 정규화하므로 **양쪽 표기 다** 다뤄야 한다.
 */
function parseIpv6(host: string): number[] | null {
  if (!host.includes(':')) return null;
  let text = host;

  // 끝이 IPv4 점표기면 hextet 2개로 접어 넣는다.
  const tail = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(text);
  if (tail) {
    const v4 = parseIpv4(tail[1]);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    text = text.slice(0, tail.index) + `${hi}:${lo}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const toHextets = (s: string): number[] | null => {
    if (s === '') return [];
    const out: number[] = [];
    for (const part of s.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null;
      out.push(parseInt(part, 16));
    }
    return out;
  };

  const head = toHextets(halves[0]);
  const rest = halves.length === 2 ? toHextets(halves[1]) : [];
  if (!head || !rest) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - rest.length;
  if (fill < 0) return null;
  return [...head, ...Array(fill).fill(0), ...rest];
}

/** 사설·루프백·링크로컬 IPv4 인가. */
function isInternalIpv4([a, b]: number[]): boolean {
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true; // 클라우드 메타데이터(169.254.169.254) 포함
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT(100.64/10)
  return false;
}

/**
 * 내부망을 가리키는 호스트인가 — IP 리터럴(v4·v6, IPv4-mapped 포함)과 내부 도메인 관용 접미.
 * IPv6 는 반드시 파싱해서 본다. 접두 문자열만 비교하면 `::ffff:7f00:1`(= 127.0.0.1) 같은
 * IPv4-mapped 표기가 그대로 빠져나간다.
 */
export function isInternalHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!host) return true;

  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
    return true;
  }

  const v4 = parseIpv4(host);
  if (v4) return isInternalIpv4(v4);

  const v6 = parseIpv6(host);
  if (v6) {
    const isZeroPrefix = (n: number) => v6.slice(0, n).every((h) => h === 0);
    if (v6.every((h) => h === 0)) return true; // :: (unspecified)
    if (isZeroPrefix(7) && v6[7] === 1) return true; // ::1 (loopback)
    // IPv4-mapped(::ffff:a.b.c.d) · IPv4-compatible(::a.b.c.d) — 안에 든 IPv4 규칙을 그대로 적용.
    if (isZeroPrefix(5) && (v6[5] === 0xffff || v6[5] === 0)) {
      const mapped = [v6[6] >> 8, v6[6] & 0xff, v6[7] >> 8, v6[7] & 0xff];
      return isInternalIpv4(mapped);
    }
    if ((v6[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 링크로컬
    if ((v6[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
    return false;
  }

  return false;
}

/**
 * 수집처로 **보내도 되는** URL 인가 — https + 내부망이 아닌 호스트.
 * 평문 http 를 막는 이유: 건의 내용이 중간에서 그대로 읽힌다.
 */
export function isAllowedWebhookUrl(value: string | undefined): boolean {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false; // 스킴 누락 등 형식 오류
  }
  if (url.protocol !== 'https:') return false;
  return !isInternalHost(url.hostname);
}
