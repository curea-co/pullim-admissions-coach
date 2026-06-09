import type { Competency } from './types'

/**
 * 전공계열·평가요소 기준 KB.
 *
 * ★ 정직성 원칙: 여기 담는 권장과목/역량은 학종 *일반 상식* 수준의
 * 넓고 논쟁의 여지가 적은(defensible) 방향성뿐이다. 특정 대학의 인재상·
 * 컷·통계·권장과목을 *발명*하지 않는다. 정확한 값은 항상 대학 모집요강/
 * 대학별 시행계획을 직접 확인하도록 caveat을 동봉한다.
 */
export type TrackKey = 'humanities' | 'social' | 'natural' | 'engineering' | 'arts_athletics'

export interface MajorCriteria {
  track: TrackKey
  /** '자연계열' 등 표시명 */
  label: string
  /** 권장 과목 *방향*(일반·defensible). 대학별 권장과목 아님. */
  recommendedSubjects: string[]
  /** 해당 계열에서 특히 부각되는 역량(일반론) */
  valuedCompetencies: Competency[]
  /** 대학별 요강 확인 caveat을 반드시 포함 */
  note: string
}

export const SOURCE_CAVEAT =
  '본 권장 방향은 일반 가이드이며, 정확한 평가요소·권장과목은 목표 대학의 모집요강/대학별 시행계획을 직접 확인하세요.'

const CRITERIA: Record<TrackKey, MajorCriteria> = {
  humanities: {
    track: 'humanities',
    label: '인문계열',
    recommendedSubjects: ['국어(독서·문학·언어와 매체)', '외국어(영어·제2외국어)', '사회(한국사·세계사·윤리)'],
    valuedCompetencies: ['ACADEMIC', 'COMMUNITY'],
    note: `언어·텍스트 해석과 인문적 사고의 깊이가 일반적으로 부각됩니다. ${SOURCE_CAVEAT}`,
  },
  social: {
    track: 'social',
    label: '사회계열',
    recommendedSubjects: ['사회(정치와 법·경제·사회문화)', '국어', '수학(확률과 통계 등 정량 기초)'],
    valuedCompetencies: ['ACADEMIC', 'CAREER', 'COMMUNITY'],
    note: `사회현상에 대한 분석력과 정량·정성 균형 잡힌 탐구가 일반적으로 부각됩니다. ${SOURCE_CAVEAT}`,
  },
  natural: {
    track: 'natural',
    label: '자연계열',
    recommendedSubjects: ['수학(미적분·기하 등 심화)', '과학(물리·화학·생명과학·지구과학)'],
    valuedCompetencies: ['ACADEMIC', 'CAREER'],
    note: `수학·과학의 심화 이수와 탐구 과정의 깊이가 일반적으로 부각됩니다. ${SOURCE_CAVEAT}`,
  },
  engineering: {
    track: 'engineering',
    label: '공학계열',
    recommendedSubjects: ['수학(미적분·기하)', '물리학', '화학', '정보(기초 프로그래밍·문제해결)'],
    valuedCompetencies: ['ACADEMIC', 'CAREER'],
    note: `물리·수학 기반의 문제해결력과 설계·구현 경험이 일반적으로 부각됩니다. ${SOURCE_CAVEAT}`,
  },
  arts_athletics: {
    track: 'arts_athletics',
    label: '예체능계열',
    recommendedSubjects: ['실기 관련 기초(전공별 상이)', '국어·외국어(소양)', '관련 이론 과목'],
    valuedCompetencies: ['CAREER', 'COMMUNITY'],
    note: `전공 실기·표현 역량과 꾸준한 활동의 일관성이 일반적으로 부각되며, 평가 비중은 전공별 편차가 큽니다. ${SOURCE_CAVEAT}`,
  },
}

export function criteriaForTrack(track: TrackKey): MajorCriteria {
  return CRITERIA[track]
}

/**
 * 대학별 평가요소(확장형). 실제 공개 출처를 인용할 수 있을 때만 채운다.
 * 날조 금지 — 출처가 불확실하면 비워 두고(`UNIVERSITY_CRITERIA = []`)
 * `universityCriteria()`가 null을 반환해 caller가 정직하게 폴백하게 한다.
 */
export interface UniversityCriteria {
  id: string
  name: string
  track: TrackKey
  evaluationFocus: string[]
  /** 공개 출처로 검증됐는지 */
  verified: boolean
  /** 인용 출처(모집요강/시행계획 등). 비검증 항목 추가 금지. */
  source: string
}

/**
 * 정직한 시드: 비어 있음.
 * 특정 대학 인재상/평가요소를 발명하지 않는다. 아키텍처와 정직한 폴백이
 * 목적이지, 가짜 데이터가 목적이 아니다. 실제 공개 출처를 인용 가능한
 * 항목만 추후 verified:true + source 명시로 추가한다.
 */
export const UNIVERSITY_CRITERIA: UniversityCriteria[] = []

export function universityCriteria(id: string): UniversityCriteria | null {
  return UNIVERSITY_CRITERIA.find((u) => u.id === id) ?? null
}
