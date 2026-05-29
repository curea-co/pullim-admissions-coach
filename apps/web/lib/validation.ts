// 폼 검증 helper — Zod 결과를 React가 다루기 쉬운 형태로 변환.
// Phase B 클라이언트 검증용. Phase C에서 동일 스키마를 NestJS pipe로 재사용.

import type { ZodError, ZodSchema } from 'zod';

export type FieldErrors = Record<string, string>;

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
