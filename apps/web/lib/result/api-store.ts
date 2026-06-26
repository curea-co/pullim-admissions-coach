'use client';

// ResultStore 서버 구현 **스캐폴드** (C) — pullim-api 또는 입시 전용 백엔드 연동.
// 전송: lib/api.ts. 엔드포인트/DTO는 백엔드 결과 저장 모듈 확정 후 채운다.
//
// 직원 작업:
//  1) 백엔드 결과 저장 API(스키마) 확정 — 사용자 스코프·삭제권 포함.
//  2) 아래 경로/DTO TODO를 실제 값으로 채운다.
//  3) lib/result/index.ts에서 resultStore를 apiResultStore로 교체.
//  4) 동기 소비처(self-answer·result-actions·mypage)를 async resultStore로 마이그레이션(설계 §5).

import { api } from '@/lib/api';
import type { ResultStore, SavedDiagnosis } from './store-types';

// TODO(C): 실제 엔드포인트로 교체.
const PATHS = {
  answers: '/results/self-answers', // GET(맵)/PUT(qid,text)
  diagnoses: '/results/diagnoses',  // GET(목록)/POST(저장)/GET(:id)
} as const;

export const apiResultStore: ResultStore = {
  async getAnswer(qid: string): Promise<string> {
    // TODO(C): GET /results/self-answers → { [qid]: text }
    const map = await api
      .get<Record<string, string>>(PATHS.answers)
      .catch(() => ({}) as Record<string, string>);
    return map[qid] ?? '';
  },
  async setAnswer(qid: string, text: string): Promise<void> {
    // TODO(C): 멱등 업서트. 서버가 사용자 스코프로 저장.
    await api.post(PATHS.answers, { qid, text });
  },
  async listDiagnoses(): Promise<SavedDiagnosis[]> {
    // TODO(C): 서버가 사용자 스코프 최신순 반환.
    return api.get<SavedDiagnosis[]>(PATHS.diagnoses).catch(() => []);
  },
  async saveDiagnosis(input): Promise<SavedDiagnosis> {
    // TODO(C): 서버가 중복(track+summary) 처리 후 항목 반환.
    return api.post<SavedDiagnosis>(PATHS.diagnoses, input);
  },
  async getDiagnosis(id: string): Promise<SavedDiagnosis | null> {
    return api.get<SavedDiagnosis>(`${PATHS.diagnoses}/${id}`).catch(() => null);
  },
};
