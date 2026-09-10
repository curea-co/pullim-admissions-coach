import { describe, it, expect } from 'vitest';
import { isAllowedWebhookUrl, isInternalHost } from './webhook-target';

// 서버가 바깥으로 보내는 요청의 목적지 판정. 이 함수가 느슨해지면 공개 라우트(/api/feedback)가
// 내부망을 향한 SSRF 통로가 된다 — 주소 **표기 방식**마다 우회가 생기므로 표기별로 못박는다.
// 특히 IPv4-mapped IPv6(`::ffff:127.0.0.1` → URL 파서는 `::ffff:7f00:1` 로 정규화)는
// 접두 문자열 비교만으로는 잡히지 않는다.

describe('isInternalHost — 내부로 판정해야 하는 것', () => {
  it.each([
    ['localhost', 'localhost'],
    ['*.localhost', 'app.localhost'],
    ['mDNS', 'printer.local'],
    ['내부 도메인', 'redis.internal'],
    ['home.arpa', 'nas.home.arpa'],
    ['IPv4 루프백', '127.0.0.1'],
    ['IPv4 루프백(다른 주소)', '127.1.2.3'],
    ['IPv4 0.0.0.0', '0.0.0.0'],
    ['사설 10/8', '10.0.0.1'],
    ['사설 172.16/12', '172.16.0.1'],
    ['사설 172.31/12', '172.31.255.254'],
    ['사설 192.168/16', '192.168.1.1'],
    ['링크로컬·메타데이터', '169.254.169.254'],
    ['CGNAT 100.64/10', '100.64.0.1'],
    ['IPv6 unspecified', '::'],
    ['IPv6 루프백', '::1'],
    ['IPv6 루프백(대괄호)', '[::1]'],
    ['IPv6 링크로컬', 'fe80::1'],
    ['IPv6 ULA(fc)', 'fc00::1'],
    ['IPv6 ULA(fd)', 'fd12:3456::1'],
    ['IPv4-mapped 루프백(점표기)', '::ffff:127.0.0.1'],
    ['IPv4-mapped 루프백(정규화 표기)', '::ffff:7f00:1'],
    ['IPv4-mapped 사설', '::ffff:10.0.0.1'],
    ['IPv4-mapped 메타데이터', '::ffff:a9fe:a9fe'],
    ['IPv4-compatible 루프백', '::127.0.0.1'],
    ['빈 문자열', ''],
  ])('%s → 내부', (_label, host) => {
    expect(isInternalHost(host)).toBe(true);
  });
});

describe('isInternalHost — 바깥으로 봐야 하는 것', () => {
  it.each([
    ['일반 도메인', 'hooks.slack.com'],
    ['서브도메인', 'a.b.example.com'],
    ['공인 IPv4', '8.8.8.8'],
    ['공인 IPv4(172.32 — 사설 경계 밖)', '172.32.0.1'],
    ['공인 IPv4(100.128 — CGNAT 경계 밖)', '100.128.0.1'],
    ['공인 IPv6', '2606:4700:4700::1111'],
    ['IPv4-mapped 공인 주소', '::ffff:8.8.8.8'],
  ])('%s → 외부', (_label, host) => {
    expect(isInternalHost(host)).toBe(false);
  });
});

describe('isAllowedWebhookUrl', () => {
  it('https + 공인 호스트만 허용', () => {
    expect(isAllowedWebhookUrl('https://hooks.slack.com/services/T0/B0/xxx')).toBe(true);
  });

  it.each([
    ['미설정', undefined],
    ['빈 값', ''],
    ['스킴 누락', 'hooks.slack.com/services'],
    ['평문 http', 'http://hooks.slack.com/services'],
    ['file', 'file:///etc/passwd'],
    ['gopher', 'gopher://example.com/'],
    ['localhost', 'https://localhost:9000/hook'],
    ['루프백', 'https://127.0.0.1/hook'],
    ['메타데이터', 'https://169.254.169.254/latest/meta-data'],
    ['IPv6 루프백', 'https://[::1]/hook'],
    ['IPv4-mapped 루프백', 'https://[::ffff:127.0.0.1]/hook'],
    ['IPv4-mapped 사설', 'https://[::ffff:10.0.0.1]/hook'],
  ])('%s 는 거절', (_label, url) => {
    expect(isAllowedWebhookUrl(url)).toBe(false);
  });

  it('URL 파서가 IPv4-mapped 를 hex 로 정규화해도 잡는다', () => {
    // 이 정규화가 접두 문자열 비교식 방어를 무력화한다 — 실제 파서 출력으로 확인해 둔다.
    expect(new URL('https://[::ffff:127.0.0.1]/').hostname).toBe('[::ffff:7f00:1]');
    expect(isAllowedWebhookUrl('https://[::ffff:7f00:1]/')).toBe(false);
  });
});
