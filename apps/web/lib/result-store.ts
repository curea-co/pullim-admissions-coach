'use client';

// 학생 자기답변 + 저장된 진단 결과 — **동기 facade**.
// 실제 저장은 lib/result/local-core(사용자 스코프 localStorage)로 위임한다 →
// 공용 브라우저에서 다른 사용자에게 데이터가 노출되던 문제(교차사용자) 차단.
//
// 백엔드 영속(C) 연동 시: 이 동기 facade의 소비처(self-answer·result-actions·mypage)를
// lib/result의 async `resultStore`로 마이그레이션한다(설계 §5).
// 설계: docs/superpowers/specs/2026-06-26-result-persistence-design.md

import {
  getAnswerCore,
  setAnswerCore,
  listDiagnosesCore,
  saveDiagnosisCore,
  getDiagnosisCore,
} from './result/local-core';
import type { SavedDiagnosis } from './result/store-types';

export type { SavedDiagnosis };

export function getAnswer(qid: string): string {
  return getAnswerCore(qid);
}
export function setAnswer(qid: string, text: string): void {
  setAnswerCore(qid, text);
}
export function listDiagnoses(): SavedDiagnosis[] {
  return listDiagnosesCore();
}
export function saveDiagnosis(input: { track: string; summary: string }): SavedDiagnosis {
  return saveDiagnosisCore(input);
}
export function getDiagnosis(id: string): SavedDiagnosis | null {
  return getDiagnosisCore(id);
}
