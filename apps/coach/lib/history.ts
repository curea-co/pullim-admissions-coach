'use client'
import type { AnalyzeResult } from './analyze'

/**
 * 진단 결과 로컬 영속화(localStorage) — 계정/DB 도입 전의 실사용 다리.
 *
 * 무학습/즉시삭제 원칙은 *서버*에 적용된다(원문 생기부는 처리 후 폐기, 저장하지 않음).
 * 여기 저장되는 것은 사용자 *본인 기기*에 남는 산출 결과(진단·처방·면접 등)뿐이며,
 * 원문 생기부 텍스트는 결과에 포함되지 않으므로 저장 대상이 아니다.
 * 학기를 넘어 결과를 다시 열어보는 "추적·증명" 경험을 계정 없이도 가능하게 한다.
 */

const KEY = 'coach:history:v1'
/** 단일 학기 결과는 가볍지만 트윈 포함 시 커질 수 있어 보관 개수를 제한. */
const MAX_RUNS = 20

export interface RunMeta {
  admissionYear: number
  grade: number
  /** StudentProfile.track5 */
  track5: string
  /** CohortResult.system (예: '2028_new') */
  system: string
  /** 학기 비교(트윈) 여부 */
  compared: boolean
}

export interface SavedRun {
  id: string
  createdAt: number
  meta: RunMeta
  result: AnalyzeResult
}

export const TRACK_LABEL: Record<string, string> = {
  humanities: '인문',
  social: '사회',
  natural: '자연',
  engineering: '공학',
  arts_athletics: '예체능',
}

const SYSTEM_LABEL: Record<string, string> = {
  '2027_old': '2027 구체제',
  '2028_new': '2028 신체제',
  '2029_new': '2029 신체제',
}

/** 목록·카드용 한 줄 라벨. 예: "고2 · 사회 · 2028 신체제" */
export function runLabel(meta: RunMeta): string {
  const track = TRACK_LABEL[meta.track5] ?? meta.track5
  const sys = SYSTEM_LABEL[meta.system] ?? meta.system
  return `고${meta.grade} · ${track} · ${sys}`
}

function canUse(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function read(): SavedRun[] {
  if (!canUse()) return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as SavedRun[]) : []
  } catch {
    return []
  }
}

function write(runs: SavedRun[]): void {
  if (!canUse()) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(runs))
  } catch {
    // 용량 초과 등 — 가장 오래된 것부터 버리고 한 번 더 시도.
    try {
      window.localStorage.setItem(KEY, JSON.stringify(runs.slice(0, Math.max(1, Math.floor(MAX_RUNS / 2)))))
    } catch {
      /* 저장 불가 — 무시(결과는 sessionStorage로 현재 화면엔 표시됨) */
    }
  }
}

/** 최신순 전체 기록. */
export function loadHistory(): SavedRun[] {
  return read().sort((a, b) => b.createdAt - a.createdAt)
}

export function getRun(id: string): SavedRun | undefined {
  return read().find((r) => r.id === id)
}

/** 가장 최근 기록(홈 재방문 시 빈 화면 대신 직전 결과 복원용). */
export function latestRun(): SavedRun | undefined {
  return loadHistory()[0]
}

function newId(): string {
  if (canUse() && 'randomUUID' in crypto) return crypto.randomUUID()
  return `run_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

/** 결과 저장 후 SavedRun 반환(최신이 앞). 보관 개수 초과분은 오래된 것부터 정리. */
export function saveRun(result: AnalyzeResult, meta: RunMeta): SavedRun {
  const run: SavedRun = { id: newId(), createdAt: Date.now(), meta, result }
  const next = [run, ...read()].slice(0, MAX_RUNS)
  write(next)
  return run
}

export function deleteRun(id: string): void {
  write(read().filter((r) => r.id !== id))
}

export function clearHistory(): void {
  if (canUse()) window.localStorage.removeItem(KEY)
}
