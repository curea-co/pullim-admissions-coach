import { describe, it, expect } from 'vitest';
import {
  FEEDBACK_CONTENT_MAX,
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
