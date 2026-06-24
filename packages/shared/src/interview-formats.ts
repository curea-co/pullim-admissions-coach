// Pullim Admissions Coach — 면접 유형 분기 (#22)
// 학생부 기반 / 제시문 기반 / 의대 MMI. 데이터셋은 연도별 변동 → 버전 표기 + EPO 검수.
// Phase D 서버가 lookupInterviewFormats 결과를 user-message에 주입.

import type { TargetTrack } from './schemas';

export type InterviewFormat = 'record_based' | 'passage_based' | 'mmi';

export const INTERVIEW_FORMAT_LABEL: Record<InterviewFormat, string> = {
  record_based: '학생부 기반',
  passage_based: '제시문 기반',
  mmi: '의대 MMI',
};

// 데이터셋 버전(연도). 면접 유형은 매년 변동하므로 갱신 시 함께 올린다.
export const INTERVIEW_FORMATS_VERSION = '2026.1' as const;

export interface UniversityInterviewFormat {
  formats: InterviewFormat[];
  weightPct?: [number, number];
  notes?: string;
}

// 주요 대학 면접 유형. Task 2에서 ~15개로 확장(리서치+EPO 검수). 키 = 정식 대학명.
export const UNIVERSITY_INTERVIEW_FORMATS: Record<string, UniversityInterviewFormat> = {
  서울대학교: {
    formats: ['passage_based', 'record_based'],
    notes: '제시문 기반 + 서류 기반, 복수 면접실 60분 내외(의대는 MMI 별도)',
  },
};

export const DEFAULT_FORMATS_BY_TRACK: Record<TargetTrack, InterviewFormat[]> = {
  humanities: ['record_based'],
  science_engineering: ['record_based'],
  medical: ['record_based', 'mmi'],
  arts_athletics: ['record_based'],
  other: ['record_based'],
};

function normalize(name: string): string {
  return name.replace(/\s/g, '');
}

export function lookupInterviewFormats(
  universities: { name: string }[],
  track: TargetTrack
): InterviewFormat[] {
  const out = new Set<InterviewFormat>(DEFAULT_FORMATS_BY_TRACK[track]);
  const byNorm = new Map(
    Object.entries(UNIVERSITY_INTERVIEW_FORMATS).map(([k, v]) => [normalize(k), v])
  );
  for (const u of universities) {
    const entry = byNorm.get(normalize(u.name));
    if (entry) for (const f of entry.formats) out.add(f);
  }
  // 안정 순서: record_based → passage_based → mmi
  const order: InterviewFormat[] = ['record_based', 'passage_based', 'mmi'];
  return order.filter((f) => out.has(f));
}
