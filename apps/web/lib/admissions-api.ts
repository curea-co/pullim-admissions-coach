'use client';

/**
 * admissions 백엔드(pullim-api) 클라이언트 — 제출→동의→진단→결과의 실 API 흐름(ADR-058).
 *
 * FE /api/analyze(레거시)를 대체한다: 진단은 백엔드 BullMQ 워커가 실행하고 결과는
 * `admissions.diagnosis_results` 에 영속된다(보존 30일·즉시삭제권). 전송은 lib/api.ts
 * (CSRF·쿠키·401 refresh) 재사용 — 베이스는 NEXT_PUBLIC_PULLIM_API.
 *
 * 결과 어댑터: 백엔드는 §6 게이트 통과 처방(rubric)을 `improvements` 컬럼에 저장하므로
 * FE AnalyzeResult(r.rubric.items 소비)로 되돌릴 때 improvements→rubric 으로 복원한다.
 */

import { api } from '@/lib/api';
import type { StudentProfile } from '@pullim/shared';
import type { AnalyzeResult } from './analyze';

// ── 백엔드 DTO(응답) ─────────────────────────────────────────────────────────
export interface SubmissionDto {
  id: string;
  targetTrack: string;
  targetUniversities: { name: string; department?: string }[];
  grade: number;
  semester: number;
  schoolType: string;
  createdAt: string;
  purgeAfter: string;
}

export type DiagnosisStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface DiagnosisDto {
  id: string;
  submissionId: string;
  status: DiagnosisStatus;
  interview: AnalyzeResult['interview'] | null;
  diagnosis: AnalyzeResult['diagnosis'] | null;
  /** 백엔드 컬럼명 — 내용은 §6 게이트 통과 rubric(FE 의 r.rubric). */
  improvements: AnalyzeResult['rubric'] | null;
  roadmap: AnalyzeResult['roadmap'] | null;
  fit: AnalyzeResult['fit'] | null;
  createdAt: string;
}

export interface ParentSummaryDto {
  studentUserId: string;
  hasResult: boolean;
  status: DiagnosisStatus | null;
  lastDiagnosedAt: string | null;
}

// ── 제출 → 동의 → 진단 enqueue ───────────────────────────────────────────────
/**
 * studentProfile payload(제출+동의 병합본)를 백엔드 흐름으로 접수한다.
 * ① POST submissions(본문 영속 — 서버가 저장 전 마스킹 재적용) ② POST consents(append-only,
 * 미성년 판정은 서버 권위값) ③ POST diagnose(동의 게이트 통과 후 pending+enqueue).
 * @returns 진단 결과 id(폴링 키)
 */
export async function submitAndDiagnose(payload: StudentProfile): Promise<string> {
  const record = payload.record;
  const submission = await api.post<SubmissionDto>('/admissions/submissions', {
    schemaVersion: payload.schemaVersion,
    recordText: record.inputType === 'text_paste' ? record.text : record.fileRef,
    inputType: record.inputType,
    maskingApplied: record.maskingApplied,
    maskedFields: record.maskedFields ?? [],
    targetTrack: payload.targetTrack,
    targetUniversities: payload.targetUniversities,
    grade: payload.currentStanding.grade,
    semester: payload.currentStanding.semester,
    schoolType: payload.currentStanding.schoolType,
    selfReportedWeakAreas: payload.selfReportedWeakAreas,
  });

  await api.post(`/admissions/submissions/${submission.id}/consents`, {
    termsAgreed: payload.consent.termsAgreed,
    privacyAgreed: payload.consent.privacyPolicyAgreed,
    guardianConsentObtained: payload.consent.guardianConsentObtained,
  });

  const diagnosis = await api.post<DiagnosisDto>(
    `/admissions/submissions/${submission.id}/diagnose`
  );
  return diagnosis.id;
}

// ── 결과 조회·폴링 ───────────────────────────────────────────────────────────
export function getDiagnosis(id: string): Promise<DiagnosisDto> {
  return api.get<DiagnosisDto>(`/admissions/results/${id}`);
}

export function listDiagnoses(): Promise<DiagnosisDto[]> {
  return api.get<DiagnosisDto[]>('/admissions/results');
}

export function getParentSummary(studentUserId: string): Promise<ParentSummaryDto> {
  return api.get<ParentSummaryDto>(`/admissions/parent/summary/${studentUserId}`);
}

/** done 상태 DTO → FE AnalyzeResult(improvements→rubric 복원). cohort 는 rubric.cohort 로 재수화. */
export function toAnalyzeResult(dto: DiagnosisDto): AnalyzeResult | null {
  if (dto.status !== 'done' || !dto.diagnosis || !dto.improvements) return null;
  return {
    cohort: dto.improvements.cohort,
    diagnosis: dto.diagnosis,
    rubric: dto.improvements,
    roadmap: dto.roadmap ?? undefined,
    fit: dto.fit ?? undefined,
    interview: dto.interview ?? undefined,
  };
}

// ── 마지막 진단 id(비민감 포인터만 세션 보관 — 본문은 서버 재조회) ──────────
const LAST_RESULT_ID_KEY = 'pullim.admissions.lastResultId';

export function saveLastResultId(id: string): void {
  try {
    window.sessionStorage.setItem(LAST_RESULT_ID_KEY, id);
  } catch {
    // 저장 실패(프라이빗 모드) — /result 진입 시 이력 API 폴백이 커버.
  }
}

export function loadLastResultId(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_RESULT_ID_KEY);
  } catch {
    return null;
  }
}
