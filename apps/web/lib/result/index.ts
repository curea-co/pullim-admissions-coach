// 결과 영속 스왑 포인트(C) — 백엔드 준비 시 한 줄만 바꾼다.
//   import { apiResultStore } from './api-store';
//   export const resultStore: ResultStore = apiResultStore;
// 그리고 동기 소비처를 async resultStore로 마이그레이션(설계 §5).

import { localResultStore } from './local-store';
import type { ResultStore } from './store-types';

export type { ResultStore, SavedDiagnosis } from './store-types';
export { setUserScope, currentScope } from './scope';

export const resultStore: ResultStore = localResultStore;
