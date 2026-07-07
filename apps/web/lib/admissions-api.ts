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

// ── 엔타이틀먼트(구매 벽) — 회원플랜: 입시코치는 admissions 이용권 보유자만(유료 전용) ──────

/** `GET /me/entitlements` 응답(부분) — pullim-api #348. flags 가 서비스별 등급 맵. */
interface MeEntitlementsResponse {
  flags: Record<string, number>;
  package: string;
  tier: string;
}

// 세션 내 캐시 — 게이트가 페이지마다(submit→consent→processing) 재마운트되며 매번 /me/entitlements
// 를 치지 않도록 결과를 재사용한다. 사용자 전환(로그인/로그아웃)·결제 후 재검증 시 무효화(교차사용자 잔존 방지).
let accessCache: boolean | null = null;

/** 엔타이틀먼트 캐시 무효화 — auth-provider(로그인/로그아웃) · 결제 후 재검증에서 호출. */
export function clearAdmissionsAccessCache(): void {
  accessCache = null;
}

/**
 * admissions 이용권 보유 여부 — **권위 신호** `GET /me/entitlements` 의 `flags.admissions`(#348).
 * ≥1 = 보유(진입 허용), 부재/0 = 미보유(free 회원 → 구매 벽). 진입 즉시 사전 판정(403 프로브 대체).
 * 세션 캐시 재사용(페이지 이동 중복호출 방지) — 갱신은 clearAdmissionsAccessCache(). 401/네트워크는 전파.
 */
export async function hasAdmissionsAccess(): Promise<boolean> {
  if (accessCache !== null) return accessCache;
  const ent = await api.get<MeEntitlementsResponse>('/me/entitlements');
  accessCache = (ent.flags?.admissions ?? 0) >= 1;
  return accessCache;
}

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
const PENDING_SUBMISSION_KEY = 'pullim.admissions.pendingSubmissionId';

/**
 * payload 지문(djb2) — 재시도 복원이 *같은 제출 입력*일 때만 이전 submission 을 재사용하게 한다.
 * consent(consentTimestamp 등 변동 필드)는 제외 — 동의 재통과·재시도 시각이 달라도 본문이 같으면
 * 동일 제출로 본다(중복 영속 방지 보장 유지).
 */
function fingerprint(payload: StudentProfile): string {
  const { consent: _consent, ...submissionPart } = payload;
  const str = JSON.stringify(submissionPart);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

export async function submitAndDiagnose(payload: StudentProfile): Promise<string> {
  const record = payload.record;
  const fp = fingerprint(payload);
  // 부분 실패 재시도 복원 — 이전 시도에서 제출은 성공했는데 동의/진단 단계가 끊겼다면
  // *같은 payload 일 때만* 그 submission 을 재사용한다(민감 본문 중복 영속 방지 + 수정 재제출은 새로).
  let submissionId: string | null = null;
  try {
    const saved = window.sessionStorage.getItem(PENDING_SUBMISSION_KEY);
    if (saved) {
      const [savedFp, savedId] = saved.split(':');
      if (savedFp === fp && savedId) submissionId = savedId;
    }
  } catch {
    // 저장소 미가용 — 새 제출로 진행.
  }
  if (!submissionId) {
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
    submissionId = submission.id;
    try {
      window.sessionStorage.setItem(PENDING_SUBMISSION_KEY, `${fp}:${submissionId}`);
    } catch {
      // 재시도 복원만 포기 — 흐름은 계속.
    }
  }

  await api.post(`/admissions/submissions/${submissionId}/consents`, {
    termsAgreed: payload.consent.termsAgreed,
    privacyAgreed: payload.consent.privacyPolicyAgreed,
    guardianConsentObtained: payload.consent.guardianConsentObtained,
  });

  // 재시도 경로 중복 enqueue 방지 — 이전 시도가 diagnose 직후 끊겼다면 이 submission 의
  // 비실패 진단이 이미 있다: 새로 enqueue 하지 않고 그 진단을 이어서 폴링한다.
  // (요청 단위 멱등키는 백엔드 후속 — 클라는 이력 조회로 보수 처리.)
  try {
    const existing = (await listDiagnoses()).find(
      (r) => r.submissionId === submissionId && r.status !== 'failed'
    );
    if (existing) {
      try {
        window.sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
      } catch {
        // 무해.
      }
      return existing.id;
    }
  } catch {
    // 이력 조회 실패 — enqueue 시도로 진행(멱등 jobId 는 진단 id 기준).
  }

  const diagnosis = await api.post<DiagnosisDto>(
    `/admissions/submissions/${submissionId}/diagnose`
  );
  try {
    window.sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
  } catch {
    // 무해 — 다음 제출 시작 시 덮어씀.
  }
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

export function saveLastResultId(id: string): boolean {
  try {
    window.sessionStorage.setItem(LAST_RESULT_ID_KEY, id);
    return true;
  } catch {
    // 저장 실패(프라이빗 모드) — 이전 세션의 낡은 포인터가 현재 제출로 오인되지 않게 제거를 시도한다.
    // 서버가 정본이므로 진행은 막지 않고, /result·/processing 이 fetchLatestDiagnosis 로 복구한다.
    try {
      window.sessionStorage.removeItem(LAST_RESULT_ID_KEY);
    } catch {
      // 제거도 불가한 환경 — 복구 경로가 최신 이력 우선이라 안전.
    }
    return false;
  }
}

/**
 * 서버 이력 기반 복구 — 로컬 id 포인터가 없거나(프라이빗 모드 저장 실패·세션 유실) 조회가 실패할 때
 * 본인 진단 이력의 최신 1건을 정본에서 가져온다(목록은 created_at DESC).
 */
export async function fetchLatestDiagnosis(): Promise<DiagnosisDto | null> {
  const rows = await listDiagnoses();
  // 서버 기본 정렬에 의존하지 않고 클라에서 createdAt DESC 를 한 번 더 보장한다.
  const sorted = [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return sorted[0] ?? null;
}

export function loadLastResultId(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_RESULT_ID_KEY);
  } catch {
    return null;
  }
}
