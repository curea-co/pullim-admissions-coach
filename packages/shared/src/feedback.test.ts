import { describe, it, expect } from 'vitest';
import {
  FEEDBACK_CONTENT_MAX,
  FEEDBACK_PAGE_URL_MAX,
  feedbackCategoryLabel,
  feedbackSubmissionSchema,
} from './feedback';

// 폼과 서버가 이 스키마 하나를 공유한다 — 경계값이 흔들리면 "브라우저에선 보내졌는데 서버가
// 400" 같은 어긋남이 바로 생긴다. 0/1/1000/1001 네 지점을 못박는다.

const content = (n: number) => 'ㄱ'.repeat(n);

describe('feedbackSubmissionSchema — 내용 길이 경계', () => {
  it('0자는 거절', () => {
    const r = feedbackSubmissionSchema.safeParse({ category: 'general', content: '' });
    expect(r.success).toBe(false);
  });

  it('공백만 있는 내용도 0자로 취급해 거절', () => {
    const r = feedbackSubmissionSchema.safeParse({ category: 'general', content: '   \n\t ' });
    expect(r.success).toBe(false);
  });

  it('1자는 통과', () => {
    const r = feedbackSubmissionSchema.safeParse({ category: 'bug', content: content(1) });
    expect(r.success).toBe(true);
  });

  it(`${FEEDBACK_CONTENT_MAX}자는 통과`, () => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'feature',
      content: content(FEEDBACK_CONTENT_MAX),
    });
    expect(r.success).toBe(true);
  });

  it(`${FEEDBACK_CONTENT_MAX + 1}자는 거절`, () => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'feature',
      content: content(FEEDBACK_CONTENT_MAX + 1),
    });
    expect(r.success).toBe(false);
  });

  it('앞뒤 공백은 다듬은 값으로 통과시킨다(서버가 받는 값 = 다듬어진 문자열)', () => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'general',
      content: '  탭을 바꾸면 스크롤이 맨 위로 올라가요.  ',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.content).toBe('탭을 바꾸면 스크롤이 맨 위로 올라가요.');
  });
});

describe('feedbackSubmissionSchema — 카테고리', () => {
  it.each(['general', 'feature', 'bug', 'etc'])('%s 는 허용', (category) => {
    const r = feedbackSubmissionSchema.safeParse({ category, content: '내용' });
    expect(r.success).toBe(true);
  });

  it.each([['unknown'], [''], ['GENERAL'], [null], [undefined], [1]])(
    '목록에 없는 카테고리(%s)는 거절',
    (category) => {
      const r = feedbackSubmissionSchema.safeParse({ category, content: '내용' });
      expect(r.success).toBe(false);
    },
  );

  it('라벨은 4종 모두 정의돼 있다(폼 옵션 = 수신처 표기)', () => {
    expect(Object.keys(feedbackCategoryLabel).sort()).toEqual(
      ['bug', 'etc', 'feature', 'general'].sort(),
    );
  });
});

describe('feedbackSubmissionSchema — 알 수 없는 필드', () => {
  it('선언하지 않은 키는 통과하되 결과에서 제거된다(수신처로 새어 나가지 않게)', () => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'general',
      content: '내용',
      sessionToken: 'should-not-survive',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ category: 'general', content: '내용' });
  });
});

// 제출 맥락. 여기서 못박는 것은 **담기는 것과 담기지 않는 것**이다 — 경로·뷰포트는 담고,
// 호스트와 사용자 정보는 어떤 모양으로 와도 남지 않는다.
describe('feedbackSubmissionSchema — 제출 맥락(context)', () => {
  const valid = { pageUrl: '/result', viewport: { w: 390, h: 844 } };

  it('없어도 통과한다 — 선택 값이다(옛 번들의 제출을 잃지 않게)', () => {
    const r = feedbackSubmissionSchema.safeParse({ category: 'general', content: '내용' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.context).toBeUndefined();
  });

  it('경로·뷰포트를 그대로 통과시킨다', () => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'general',
      content: '내용',
      context: valid,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.context).toEqual(valid);
  });

  it.each([
    ['절대 URL — 호스트가 섞인다', 'https://evil.example.com/x'],
    ['스킴 상대 URL', '//evil.example.com/x'],
    ['상대 경로', 'result?tab=1'],
    ['빈 문자열', ''],
  ])('경로가 아닌 pageUrl(%s)은 거절', (_label, pageUrl) => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'general',
      content: '내용',
      context: { ...valid, pageUrl },
    });
    expect(r.success).toBe(false);
  });

  // 쿼리·해시는 일회성 토큰·이메일이 실리는 자리다. **클라이언트를 믿지 않고** 스키마에서
  // 잘라내, 옛 번들이나 변조된 요청이 보낸 값도 저장 대상에는 남지 않게 한다.
  it.each([
    ['쿼리', '/login?next=/mypage&code=one-time-token', '/login'],
    ['해시', '/result#card-3', '/result'],
    ['둘 다', '/result?tab=gap#card-3', '/result'],
  ])('pageUrl 의 %s 는 저장 전에 제거된다', (_label, pageUrl, expected) => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'general',
      content: '내용',
      context: { ...valid, pageUrl },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.context?.pageUrl).toBe(expected);
      expect(JSON.stringify(r.data)).not.toMatch(/one-time-token|card-3|tab=gap/);
    }
  });

  // 길이를 쿼리 제거보다 먼저 재면, **버릴 부분 때문에** 제출이 거절된다 — 저장될 값은
  // 짧은 `/login` 인데도. 순서가 곧 계약이다(민감한 쿼리는 버리고 제출은 받는다).
  it('제거될 쿼리가 길이 상한을 넘겨도 거절하지 않는다 — 정제 뒤 길이를 잰다', () => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'general',
      content: '내용',
      context: { ...valid, pageUrl: `/login?code=${'t'.repeat(FEEDBACK_PAGE_URL_MAX * 2)}` },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.context?.pageUrl).toBe('/login');
  });

  it(`pageUrl 은 ${FEEDBACK_PAGE_URL_MAX}자까지 — 넘으면 거절(폼이 미리 자른다)`, () => {
    const ok = `/x${'a'.repeat(FEEDBACK_PAGE_URL_MAX - 2)}`;
    expect(
      feedbackSubmissionSchema.safeParse({ category: 'general', content: '내용', context: { ...valid, pageUrl: ok } })
        .success,
    ).toBe(true);
    expect(
      feedbackSubmissionSchema.safeParse({
        category: 'general',
        content: '내용',
        context: { ...valid, pageUrl: `${ok}a` },
      }).success,
    ).toBe(false);
  });

  it.each([
    ['소수', { w: 390.5, h: 844 }],
    ['음수', { w: -1, h: 844 }],
    ['문자열', { w: '390', h: 844 }],
    ['키 누락', { w: 390 }],
  ])('뷰포트가 정수 픽셀이 아니면(%s) 거절', (_label, viewport) => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'general',
      content: '내용',
      context: { ...valid, viewport },
    });
    expect(r.success).toBe(false);
  });

  it('맥락에 끼워 넣은 사용자 정보는 제거된다(수신처로 새어 나가지 않게)', () => {
    const r = feedbackSubmissionSchema.safeParse({
      category: 'general',
      content: '내용',
      context: { ...valid, email: 'a@b.c', displayName: '박준호', userId: 'u_1' },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.context).toEqual(valid);
  });
});
