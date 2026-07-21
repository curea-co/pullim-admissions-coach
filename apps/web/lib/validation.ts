// 폼 검증 helper — Zod 결과를 React가 다루기 쉬운 형태로 변환.
// Phase B 클라이언트 검증용. Phase C에서 동일 스키마를 NestJS pipe로 재사용.

import type { ZodError, ZodSchema } from 'zod';

export type FieldErrors = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
  'record.text': '생기부 본문',
  'record.maskingApplied': '개인정보 마스킹 확인',
  targetTrack: '지원 학부',
  'currentStanding.grade': '학년',
  'currentStanding.semester': '학기',
  'currentStanding.schoolType': '학교 유형',
  targetUniversities: '목표 대학',
  selfReportedWeakAreas: '보완이 필요한 영역',
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? FIELD_LABELS[key.split('.')[0]] ?? '입력 항목';
}

export function flattenErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.');
    if (!(path in out)) {
      out[path] = issue.message;
    }
  }
  return out;
}

export type ValidationResult<T> =
  | { ok: true; data: T; errors: null }
  | { ok: false; data: null; errors: FieldErrors };

export function validate<T>(
  schema: ZodSchema<T>,
  input: unknown
): ValidationResult<T> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data, errors: null };
  return { ok: false, data: null, errors: flattenErrors(r.error) };
}
