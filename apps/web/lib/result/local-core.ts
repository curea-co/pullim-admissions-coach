'use client';

// 사용자 스코프 localStorage CRUD(동기 코어). result-store(동기 facade)와
// local-store(async ResultStore)가 공유한다. 키를 현재 스코프로 격리해
// 공용 브라우저에서 다른 사용자에게 데이터가 노출되지 않게 한다.

import { currentScope } from './scope';
import { safeRandomUUID } from '@/lib/uuid';
import type { SavedDiagnosis } from './store-types';

const ANSWERS_BASE = 'puds-self-answers';
const SAVED_BASE = 'puds-saved-diagnoses';

const answersKey = () => `${ANSWERS_BASE}:${currentScope()}`;
const savedKey = () => `${SAVED_BASE}:${currentScope()}`;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getAnswerCore(qid: string): string {
  return readJSON<Record<string, string>>(answersKey(), {})[qid] ?? '';
}

export function setAnswerCore(qid: string, text: string): void {
  const m = readJSON<Record<string, string>>(answersKey(), {});
  m[qid] = text;
  try {
    localStorage.setItem(answersKey(), JSON.stringify(m));
  } catch {
    // 저장소 비가용 — 무시(자기답변은 비핵심).
  }
}

export function listDiagnosesCore(): SavedDiagnosis[] {
  // 최신순: createdAt 내림차순. 동일 ms는 삽입 역순(최신 먼저) 유지 위해 pre-reverse + stable sort.
  return readJSON<SavedDiagnosis[]>(savedKey(), [])
    .slice()
    .reverse()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveDiagnosisCore(input: { track: string; summary: string }): SavedDiagnosis {
  const list = readJSON<SavedDiagnosis[]>(savedKey(), []);
  const existing = list.find((d) => d.track === input.track && d.summary === input.summary);
  if (existing) return existing;
  const d: SavedDiagnosis = {
    id: `dx_${safeRandomUUID()}`,
    createdAt: new Date().toISOString(),
    track: input.track,
    summary: input.summary,
  };
  list.push(d);
  try {
    localStorage.setItem(savedKey(), JSON.stringify(list));
  } catch {
    // 저장 실패 시에도 생성된 항목은 반환(호출자 UX 유지). 영속은 서버(C)에서 보장.
  }
  return d;
}

export function getDiagnosisCore(id: string): SavedDiagnosis | null {
  return readJSON<SavedDiagnosis[]>(savedKey(), []).find((d) => d.id === id) ?? null;
}
