// Pullim Admissions Coach — 결과 화면 헤더용 표시 프로필 (#25)
// sessionStorage에 저장되는 *비-PII* 헤더 필드만. 생기부 text·마스킹 필드는 포함하지 않는다.

import { z } from 'zod';
import {
  schoolTypeEnum,
  targetTrackEnum,
  schoolTypeLabel,
  targetTrackLabel,
  targetUniversitySchema,
} from './schemas';

export const submittedProfileSchema = z.object({
  grade: z.number().int().min(1).max(3),
  semester: z.union([z.literal(1), z.literal(2)]),
  schoolType: schoolTypeEnum,
  targetTrack: targetTrackEnum,
  targetUniversities: z.array(targetUniversitySchema).max(3),
});

export type SubmittedProfile = z.infer<typeof submittedProfileSchema>;

export function formatStandingLabel(p: SubmittedProfile): string {
  return `고${p.grade} ${p.semester}학기 · ${schoolTypeLabel[p.schoolType]} · ${targetTrackLabel[p.targetTrack]}`;
}
