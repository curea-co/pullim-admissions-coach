// 건의하기(사용자 피드백) 제출 스키마 — FE 폼과 서버 라우트가 **같은 정의**를 쓴다.
//
// 왜 shared 인가: 검증이 두 곳에 있으면 반드시 갈라진다(FE 는 1000자, 서버는 2000자 같은 식).
// 폼(components/feedback/feedback-widget.tsx)과 수신 라우트(app/api/feedback/route.ts)가
// 이 파일 하나만 참조하도록 묶어 둔다.
//
// 이 스키마는 학생 프로필(schemas.ts)과 무관한 **운영 채널**이다 — 생기부·진단 결과는 담기지
// 않는다. 사용자가 직접 적은 문장만 받는다.

import { z } from 'zod';

/** 카테고리 4종 — 시안(모달 드롭다운) 순서 그대로. */
export const feedbackCategoryEnum = z.enum([
  'general', // 일반 문의
  'feature', // 기능 요청
  'bug', // 버그 신고
  'etc', // 기타
]);
export type FeedbackCategory = z.infer<typeof feedbackCategoryEnum>;

/** 한국어 라벨 — 폼 옵션과 수신처 알림 본문이 같은 표기를 쓰게 한다. */
export const feedbackCategoryLabel: Record<FeedbackCategory, string> = {
  general: '일반 문의',
  feature: '기능 요청',
  bug: '버그 신고',
  etc: '기타',
};

/** 내용 길이 상한 — textarea 의 maxLength·글자수 표시와 같은 값을 써야 한다. */
export const FEEDBACK_CONTENT_MAX = 1000;

/**
 * 제출 화면 경로 길이 상한. 폼이 **자르고** 서버가 같은 값으로 검증한다 — 두 숫자가 갈라지면
 * 경로가 긴 화면에서 정상 건의가 400 으로 막힌다.
 */
export const FEEDBACK_PAGE_URL_MAX = 512;

/**
 * 저장할 화면 경로만 남긴다 — **쿼리와 프래그먼트는 버린다.**
 *
 * 쿼리는 일회성 토큰·이메일·초대 코드·복귀 주소(`?next=`)가 실리는 자리다. 그대로 저장하면 그
 * 값이 건의 레코드로 복제돼 admin 화면·백업·로그에 남는다. 화면을 아는 데 필요한 것은 경로뿐이다.
 *
 * 스키마의 transform 으로 걸어 **클라이언트와 서버 양쪽에서** 같은 규칙이 적용되게 한다 —
 * 폼이 실수로(또는 옛 번들이) 쿼리를 통째로 보내도 저장되는 값에는 남지 않는다.
 */
export function feedbackPagePath(raw: string): string {
  const cut = raw.search(/[?#]/);
  return cut === -1 ? raw : raw.slice(0, cut);
}

/**
 * 클라이언트만 알 수 있는 제출 맥락.
 *
 * 담기는 것은 **화면 경로와 뷰포트뿐**이다:
 *  - `pageUrl` 은 `pathname` — **호스트도 쿼리도 담지 않는다**(호스트는 서버가 이미 알고,
 *    쿼리는 민감한 값이 실리는 자리다). 절대 URL·스킴 상대 URL(`//other`)은 거절해 남의
 *    주소가 저장값에 섞이지 않게 한다.
 *  - `userAgent`·`appVersion` 은 **여기에 없다.** 서버가 요청 헤더·빌드 환경에서 채운다
 *    (클라이언트가 보낸 값보다 신뢰도가 높다).
 *  - 사용자 식별·프로필(이름·이메일·등급 등)은 **어떤 경우에도 담지 않는다.**
 */
export const feedbackClientContextSchema = z.object({
  pageUrl: z
    .string()
    .trim()
    .max(FEEDBACK_PAGE_URL_MAX)
    .regex(/^\/(?!\/)/, '경로는 / 로 시작하는 상대 경로여야 합니다.')
    .transform(feedbackPagePath),
  viewport: z.object({
    // 픽셀 값이므로 정수·음이 아닌 값만. 상한은 사람이 쓰는 화면을 한참 넘는 자리에 둔다.
    w: z.number().int().nonnegative().max(100_000),
    h: z.number().int().nonnegative().max(100_000),
  }),
});

export type FeedbackClientContext = z.infer<typeof feedbackClientContextSchema>;

export const feedbackSubmissionSchema = z.object({
  category: feedbackCategoryEnum,
  // trim 을 **먼저** 건다(zod 3 는 체크를 선언 순서대로 적용한다) — 공백만 입력한 제출은
  // 빈 내용으로 취급해 거절된다. 서버가 받는 값도 이미 다듬어진 문자열이다.
  content: z
    .string()
    .trim()
    .min(1, '내용을 입력해 주세요.')
    .max(FEEDBACK_CONTENT_MAX, `내용은 ${FEEDBACK_CONTENT_MAX}자까지 보낼 수 있어요.`),
  // **선택**이다. 배포 직후 옛 번들이 열려 있는 탭은 이 필드 없이 보낸다 — 그 제출을 400 으로
  // 막으면 맥락 한 줄 때문에 건의 자체를 잃는다. 맥락은 있으면 좋은 값이지 필수 값이 아니다.
  context: feedbackClientContextSchema.optional(),
});

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;
