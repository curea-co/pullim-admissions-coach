'use client';

// ResultStore 로컬 구현 — 사용자 스코프 localStorage(local-core)의 async 래퍼.
// 백엔드(C) 연동 전까지의 기본 구현. 동기 소비처는 result-store.ts facade를 계속 쓴다.

import type { ResultStore, SavedDiagnosis } from './store-types';
import {
  getAnswerCore,
  setAnswerCore,
  listDiagnosesCore,
  saveDiagnosisCore,
  getDiagnosisCore,
} from './local-core';

export const localResultStore: ResultStore = {
  async getAnswer(qid: string): Promise<string> {
    return getAnswerCore(qid);
  },
  async setAnswer(qid: string, text: string): Promise<void> {
    setAnswerCore(qid, text);
  },
  async listDiagnoses(): Promise<SavedDiagnosis[]> {
    return listDiagnosesCore();
  },
  async saveDiagnosis(input): Promise<SavedDiagnosis> {
    return saveDiagnosisCore(input);
  },
  async getDiagnosis(id: string): Promise<SavedDiagnosis | null> {
    return getDiagnosisCore(id);
  },
};
