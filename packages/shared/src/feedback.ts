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

export const feedbackSubmissionSchema = z.object({
  category: feedbackCategoryEnum,
  // trim 을 **먼저** 건다(zod 3 는 체크를 선언 순서대로 적용한다) — 공백만 입력한 제출은
  // 빈 내용으로 취급해 거절된다. 서버가 받는 값도 이미 다듬어진 문자열이다.
  content: z
    .string()
    .trim()
    .min(1, '내용을 입력해 주세요.')
    .max(FEEDBACK_CONTENT_MAX, `내용은 ${FEEDBACK_CONTENT_MAX}자까지 보낼 수 있어요.`),
});

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;
