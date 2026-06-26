// Pullim Admissions Coach — shared barrel.
// Phase B: Zod schemas synced with docs/student_profile_schema_v0.1.json.
// Phase D: AI output DTOs synced with definition v0.3 §4.

export * from './schemas';
export * from './pii';
export * from './diagnosis';
export * from './guardrails/unreflected-activities';
export * from './submitted-profile';
export * from './interview-formats';
// #16 흡수 — 코호트(학년별 제도 #24) + §6.2 합법성 게이트(미래 AI 처방 필터)
export * from './cohort';
export * from './legality';
export * from './analysis-input';
