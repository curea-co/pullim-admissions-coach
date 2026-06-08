// Pullim Admissions Coach — shared barrel.
// Phase B: Zod schemas synced with docs/student_profile_schema_v0.1.json.
// Phase D: AI output DTOs synced with definition v0.3 §4.

export * from './schemas';
// profile.ts intentionally re-defines StudentProfile (new Task-1 schema). Re-export
// explicitly so it shadows the legacy schemas.ts StudentProfile and avoids the
// ambiguous `export *` collision (TS2308). New consumers (@pullim/engine, apps/coach)
// get this StudentProfile + StudentProfileSchema.
export { StudentProfileSchema, type StudentProfile } from './profile'
