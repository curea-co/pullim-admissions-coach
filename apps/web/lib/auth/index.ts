// 교체 지점 — 직원이 나중에 PullimApiAuthAdapter로 바꾸면 끝.
import { mockAuthAdapter } from './mock-adapter';
import type { AuthAdapter } from './types';
export const auth: AuthAdapter = mockAuthAdapter;
export * from './types';
