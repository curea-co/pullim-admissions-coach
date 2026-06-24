// 학생 자기답변 + 저장된 진단 결과 — mock(localStorage). 단일 교체 지점.
// employee 후속: 이 파일을 서버 연동 구현으로 교체(인터페이스 유지).
export type SavedDiagnosis = { id: string; createdAt: string; track: string; summary: string };

const ANSWERS_KEY = 'puds-self-answers';   // qid -> text
const SAVED_KEY = 'puds-saved-diagnoses';  // SavedDiagnosis[]

function readJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
}

export function getAnswer(qid: string): string {
  return readJSON<Record<string, string>>(ANSWERS_KEY, {})[qid] ?? '';
}
export function setAnswer(qid: string, text: string): void {
  const m = readJSON<Record<string, string>>(ANSWERS_KEY, {});
  m[qid] = text;
  localStorage.setItem(ANSWERS_KEY, JSON.stringify(m));
}
export function listDiagnoses(): SavedDiagnosis[] {
  return readJSON<SavedDiagnosis[]>(SAVED_KEY, []).slice().reverse();
}
export function saveDiagnosis(input: { track: string; summary: string }): SavedDiagnosis {
  const list = readJSON<SavedDiagnosis[]>(SAVED_KEY, []);
  const d: SavedDiagnosis = {
    id: `dx_${list.length + 1}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    track: input.track,
    summary: input.summary,
  };
  list.push(d);
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  return d;
}
export function getDiagnosis(id: string): SavedDiagnosis | null {
  return readJSON<SavedDiagnosis[]>(SAVED_KEY, []).find((d) => d.id === id) ?? null;
}
