// Pullim Admissions Coach — shared types & schemas
// Phase B: Zod schemas synced with docs/student_profile_schema_v0.1.json
// Phase D: AI output DTOs synced with definition v0.3 §4

export const SCHEMA_VERSION = '0.1' as const;

export type TargetTrack =
  | 'humanities'
  | 'engineering'
  | 'medical_natural'
  | 'arts_athletics';

export type SchoolType = 'general' | 'special_purpose' | 'autonomous_private';
