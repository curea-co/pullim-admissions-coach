import { describe, it, expect } from 'vitest';
import {
  isAllowedWebhookHost,
  isAllowedWebhookUrl,
  isInternalHost,
  parseWebhookTarget,
  resolvesToPublicOnly,
} from './webhook-target';

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

describe('isAllowedWebhookHost — 호스트 allowlist', () => {
  it('미설정이면 통과시킨다(다른 방어에 맡긴다)', () => {
    expect(isAllowedWebhookHost('hooks.slack.com', undefined)).toBe(true);
    expect(isAllowedWebhookHost('hooks.slack.com', '  ')).toBe(true);
  });

  it('정확히 일치하거나 하위 도메인만 인정', () => {
    expect(isAllowedWebhookHost('hooks.slack.com', 'hooks.slack.com')).toBe(true);
    expect(isAllowedWebhookHost('a.hooks.slack.com', 'hooks.slack.com')).toBe(true);
    expect(isAllowedWebhookHost('hooks.slack.com.evil.test', 'hooks.slack.com')).toBe(false);
    expect(isAllowedWebhookHost('evil.test', 'hooks.slack.com,discord.com')).toBe(false);
    expect(isAllowedWebhookHost('discord.com', 'hooks.slack.com,discord.com')).toBe(true);
  });
});

describe('parseWebhookTarget', () => {
  it('허용되면 파싱된 URL 을 그대로 돌려준다(호출부가 다시 파싱하지 않게)', () => {
    const url = parseWebhookTarget('https://hooks.slack.com/x', 'hooks.slack.com');
    expect(url?.hostname).toBe('hooks.slack.com');
    expect(url?.href).toBe('https://hooks.slack.com/x');
  });

  it('allowlist 밖이면 null', () => {
    expect(parseWebhookTarget('https://evil.test/x', 'hooks.slack.com')).toBeNull();
  });

  it('내부 주소·비 https 면 null', () => {
    expect(parseWebhookTarget('https://127.0.0.1/x', undefined)).toBeNull();
    expect(parseWebhookTarget('http://hooks.slack.com/x', undefined)).toBeNull();
  });
});

describe('resolvesToPublicOnly — 이름이 가리키는 주소까지 확인', () => {
  const lookupOf = (...addresses: string[]) => async () => addresses;

  it('공인 주소로만 해석되면 통과', async () => {
    expect(await resolvesToPublicOnly('hooks.slack.com', lookupOf('3.5.7.9'))).toBe(true);
  });

  it('공인 도메인이 루프백으로 해석되면 거절(127.0.0.1.nip.io 류)', async () => {
    expect(await resolvesToPublicOnly('127.0.0.1.nip.io', lookupOf('127.0.0.1'))).toBe(false);
  });

  it('여러 주소 중 하나라도 내부면 거절', async () => {
    expect(await resolvesToPublicOnly('mixed.test', lookupOf('3.5.7.9', '10.0.0.1'))).toBe(false);
  });

  it('IPv4-mapped 로 해석돼도 거절', async () => {
    expect(await resolvesToPublicOnly('sneaky.test', lookupOf('::ffff:127.0.0.1'))).toBe(false);
  });

  it('해석 결과가 없거나 실패하면 거절(모르면 보내지 않는다)', async () => {
    expect(await resolvesToPublicOnly('empty.test', lookupOf())).toBe(false);
    expect(
      await resolvesToPublicOnly('boom.test', async () => {
        throw new Error('ENOTFOUND');
      }),
    ).toBe(false);
  });

  it('IP 리터럴은 DNS 를 보지 않고 문자열 판정으로 끝낸다', async () => {
    const never = async () => {
      throw new Error('DNS 를 보면 안 된다');
    };
    expect(await resolvesToPublicOnly('8.8.8.8', never)).toBe(true);
    expect(await resolvesToPublicOnly('127.0.0.1', never)).toBe(false);
    expect(await resolvesToPublicOnly('[::1]', never)).toBe(false);
  });
});
