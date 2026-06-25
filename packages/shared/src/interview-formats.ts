// Pullim Admissions Coach — 면접 유형 분기 (#22)
// 학생부 기반 / 제시문 기반 / 의대 MMI. 데이터셋은 연도별 변동 → 버전 표기 + EPO 검수.
// 2026 사이클 기준으로 병렬 리서치+출처 검증 워크플로로 15개 대학 조사 완료. EPO(최선혜) 검수 대상.
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

// 주요 대학 면접 유형. 2026 사이클 기준, 리서치+EPO 검수 대상. 키 = 정식 대학명.
// 순서: SKY → 주요 인서울 → 의대 MMI 핵심
export const UNIVERSITY_INTERVIEW_FORMATS: Record<string, UniversityInterviewFormat> = {
  // SKY
  서울대학교: {
    formats: ['record_based', 'passage_based', 'mmi'],
    weightPct: [30, 50],
    notes: '지역균형=서류기반(면접 30%)·일반전형=제시문 구술고사(면접 50%)·의대 한정 MMI(복수 면접실 60분)',
  },
  고려대학교: {
    formats: ['record_based', 'passage_based', 'mmi'],
    weightPct: [40, 40],
    notes: '계열적합형=제시문+서류확인 혼재(면접 40%)·학업우수형 서류100% 면접 없음·의대 한정 MMI',
  },
  연세대학교: {
    formats: ['passage_based', 'mmi'],
    notes: '활동우수형·국제형=제시문 현장녹화면접(준비 8분+면접 5분, 서류 60%+면접 40%)·의예과 한정 MMI(20분)',
  },

  // 주요 인서울
  성균관대학교: {
    formats: ['record_based'],
    notes: '성균인재전형(면접형) 한정 서류기반 인·적성면접(2단계 면접 30%)·대부분 학종은 서류 100% 면접 없음 (EPO 확인 필요)',
  },
  한양대학교: {
    formats: ['record_based', 'passage_based'],
    notes: '2026부터 공과대학 10개 모집단위·한양인터칼리지(자연) 제시문 면접 신규 도입·사범대는 서류기반 유지(2단계 면접 30%)',
  },
  서강대학교: {
    formats: ['record_based'],
    notes: '일반 학종 서류 100% 면접 없음·특성화고졸업자전형 한정 2단계 블라인드 서류기반 면접(면접 20%)',
  },
  중앙대학교: {
    formats: ['record_based'],
    notes: 'CAU융합형·탐구형 모두 서류기반 개별면접(2인·10분·서류 70%+면접 30%)·제시문·MMI 없음·의학부 2026 신규 도입',
  },
  경희대학교: {
    formats: ['record_based'],
    notes: '네오르네상스 전형 서류확인+공통질문(2인·10분·서류 70%+면접 30%)·전 모집단위 제시문 없음·의예과도 동일',
  },
  한국외국어대학교: {
    formats: ['record_based'],
    notes: '학종(면접형) 블라인드 인·적성면접(2인·10분·서류 50%+면접 50%)·제시문 없음·서류형은 면접 없음',
  },
  이화여자대학교: {
    formats: ['record_based'],
    notes: '2026 미래인재(면접형) 신설: 서류기반 개별면접(서류 70%+면접 30%)·제시문·MMI 없음·서류형 병렬 운영',
  },
  서울시립대학교: {
    formats: ['record_based'],
    weightPct: [50, 50],
    notes: '학종Ⅰ(면접형) 서류기반 확인면접(입학사정관+전임교원 2인·12분·서류 50%+면접 50%)·제시문 없음',
  },
  건국대학교: {
    formats: ['record_based'],
    notes: 'KU자기추천 서류기반 블라인드 개별면접(2인·10분·1단계 70%+면접 30%)·제시문·MMI 없음',
  },
  인하대학교: {
    formats: ['record_based'],
    notes: '2026 인하미래인재(면접형): 서류기반면접(서류 70%+면접 30%)·제시문·MMI 없음·서류형은 면접 없음',
  },

  // 의대 MMI 핵심
  가톨릭대학교: {
    formats: ['record_based', 'mmi'],
    weightPct: [70, 30],
    notes: '학종 서류기반 면접(서류 70%+면접 30%)·의예과 한정 인·적성면접(상황제시·복수면접실·20분) 운영 보도·공식 요강 MMI 용어 미확인 (EPO 확인 필요)',
  },
  울산대학교: {
    formats: ['record_based', 'mmi'],
    weightPct: [50, 50],
    notes: '잠재역량전형 서류기반면접(1단계 50%+면접 50%)·의예과 한정 상황제시+복수면접실 30분 운영(MMI 구조 부합)·공식 용어 미확인 (EPO 확인 필요)',
  },
};

export const DEFAULT_FORMATS_BY_TRACK: Record<TargetTrack, InterviewFormat[]> = {
  humanities: ['record_based'],
  science_engineering: ['record_based'],
  medical: ['record_based', 'mmi'],
  arts_athletics: ['record_based'],
  undeclared: ['record_based'],
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
  // mmi는 의대(medical) 한정 — 비의대 계열에는 대학 매칭으로도 부여하지 않는다(의예과 한정 제약).
  if (track !== 'medical') out.delete('mmi');
  // 안정 순서: record_based → passage_based → mmi
  const order: InterviewFormat[] = ['record_based', 'passage_based', 'mmi'];
  return order.filter((f) => out.has(f));
}
