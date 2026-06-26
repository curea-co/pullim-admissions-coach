// 결과 영속 스왑 계약 (C). 설계: docs/superpowers/specs/2026-06-26-result-persistence-design.md
// 로컬(localStorage, 사용자 스코프) ↔ 서버(pullim-api) 구현이 이 인터페이스를 공유한다.

export type SavedDiagnosis = {
  id: string;
  createdAt: string; // ISO
  track: string;     // 공학계열 등
  summary: string;   // 한 줄 요약
};

export interface ResultStore {
  /** 면접 자기답변 — qid별 텍스트. 미저장이면 ''. */
  getAnswer(qid: string): Promise<string>;
  setAnswer(qid: string, text: string): Promise<void>;
  /** 저장된 진단 — 최신순. */
  listDiagnoses(): Promise<SavedDiagnosis[]>;
  /** 동일 track+summary는 중복 저장하지 않고 기존 항목 반환. */
  saveDiagnosis(input: { track: string; summary: string }): Promise<SavedDiagnosis>;
  getDiagnosis(id: string): Promise<SavedDiagnosis | null>;
}
