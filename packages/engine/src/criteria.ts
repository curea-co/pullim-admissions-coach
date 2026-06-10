import type { Competency } from './types'

/**
 * 전공계열·평가요소 기준 KB.
 *
 * ★ 정직성 원칙: 여기 담는 권장과목/역량은 학종 *일반 상식* 수준의
 * 넓고 논쟁의 여지가 적은(defensible) 방향성, 또는 1차 출처로 검증된
 * 데이터뿐이다. 특정 대학의 인재상·컷·통계·권장과목을 *발명*하지 않는다.
 * 정확한 값은 항상 대학 모집요강/대학별 시행계획을 직접 확인하도록
 * caveat을 동봉한다.
 */
export type TrackKey = 'humanities' | 'social' | 'natural' | 'engineering' | 'arts_athletics'

export interface MajorCriteria {
  track: TrackKey
  /** '자연계열' 등 표시명 */
  label: string
  /** 권장 과목 *방향*(일반·defensible) 또는 검증된 매핑. */
  recommendedSubjects: string[]
  /** 해당 계열에서 특히 부각되는 역량(일반론) */
  valuedCompetencies: Competency[]
  /** 권장과목 출처(검증된 경우에만). 없으면 생략. */
  subjectsSource?: string
  /** 대학별 요강 확인 caveat을 반드시 포함 */
  note: string
}

export const SOURCE_CAVEAT =
  '본 권장 방향은 일반 가이드이며, 정확한 평가요소·권장과목은 목표 대학의 모집요강/대학별 시행계획을 직접 확인하세요.'

/**
 * 대학마다 공통 평가요소에 대한 가중치를 자체 조정한다는 안내.
 * 공통 프레임워크를 절대화하지 않도록 동봉.
 */
export const UNIVERSITY_WEIGHT_CAVEAT =
  '공통 평가요소·평가항목은 5개 대학 공동연구의 표준이며, 개별 대학은 가중치·운영 방식을 자체 조정합니다.'

/**
 * 자연계열 전공 학문 분야의 교과 이수 권장과목 안내 리플릿(2022, 5개 대학 공동연구).
 * natural/engineering 트랙의 검증된 권장과목 출처.
 */
const NATURAL_SUBJECTS_SOURCE =
  'https://kr.object.gov-ncloudstorage.com/khuiphakstorage/upload/20230329032924540_대학 자연계열 전공 학문 분야의 교과 이수 권장과목 안내 리플릿_fv(0329)_수정본.pdf'

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
    recommendedSubjects: ['핵심: 수학Ⅰ·Ⅱ·미적분·기하', '과학: 전공별(물리·화학·생명·지구)', '권장: 확률과통계'],
    valuedCompetencies: ['ACADEMIC', 'CAREER'],
    subjectsSource: NATURAL_SUBJECTS_SOURCE,
    note: `수학·과학의 심화 이수와 탐구 과정의 깊이가 일반적으로 부각됩니다. ${SOURCE_CAVEAT}`,
  },
  engineering: {
    track: 'engineering',
    label: '공학계열',
    recommendedSubjects: ['핵심: 수학Ⅰ·Ⅱ·미적분·기하 + 물리학Ⅰ·Ⅱ', '권장: 확률과통계·화학Ⅰ·인공지능수학'],
    valuedCompetencies: ['ACADEMIC', 'CAREER'],
    subjectsSource: NATURAL_SUBJECTS_SOURCE,
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
 * 학종 공통 평가요소 및 평가항목 (3역량·10항목).
 * 5개 대학(건국·경희·서울여대·연세·중앙) 공동연구 1차 출처(PDF) VERBATIM.
 */
export interface EvalItem {
  key: string
  label: string
  definition: string
}
export interface EvalCompetency {
  key: 'ACADEMIC' | 'CAREER' | 'COMMUNITY'
  label: string
  definition: string
  items: EvalItem[]
}

export const EVAL_FRAMEWORK_SOURCE =
  'https://kr.object.gov-ncloudstorage.com/khuiphakstorage/upload/20220302045039840_(소책자) NEW 학생부종합전형 공통 평가요소 및 평가항목(5개 대학).pdf'

export const EVAL_FRAMEWORK_NAME =
  'NEW 학생부종합전형 공통 평가요소 및 평가항목 (5개 대학, 2022)'

export const COMMON_EVALUATION_FRAMEWORK: EvalCompetency[] = [
  {
    key: 'ACADEMIC',
    label: '학업역량',
    definition: '대학교육을 충실히 이수하는 데 필요한 수학 능력',
    items: [
      {
        key: 'achievement',
        label: '학업성취도',
        definition: '고교 교육과정에서 이수한 교과의 성취수준이나 학업 발전의 정도',
      },
      {
        key: 'attitude',
        label: '학업태도',
        definition: '학업을 수행하고 학습해 나가려는 의지와 노력',
      },
      {
        key: 'inquiry',
        label: '탐구력',
        definition: '지적 호기심을 바탕으로 사물과 현상에 대해 탐구하고, 문제를 해결하려는 노력',
      },
    ],
  },
  {
    key: 'CAREER',
    label: '진로역량',
    definition: '자신의 진로와 전공(계열)에 관한 탐색 노력과 준비 정도',
    items: [
      {
        key: 'major_course_effort',
        label: '전공(계열) 관련 교과 이수 노력',
        definition: '고교 교육과정에서 전공(계열)에 필요한 과목을 선택하여 이수한 정도',
      },
      {
        key: 'major_course_achievement',
        label: '전공(계열) 관련 교과 성취도',
        definition: '전공(계열) 관련 과목을 수강하고 취득한 학업성취 수준',
      },
      {
        key: 'career_exploration',
        label: '진로 탐색 활동과 경험',
        definition: '자신의 진로를 탐색하는 과정에서 이루어진 활동이나 경험 및 노력 정도',
      },
    ],
  },
  {
    key: 'COMMUNITY',
    label: '공동체역량',
    definition: '공동체의 일원으로서 갖춰야 할 바람직한 사고와 행동',
    items: [
      {
        key: 'collaboration_communication',
        label: '협업과 소통능력',
        definition: '공동체의 목표를 달성하기 위해 협력하며, 구성원들과 합리적인 의사소통을 할 수 있는 능력',
      },
      {
        key: 'sharing_consideration',
        label: '나눔과 배려',
        definition:
          '상대방을 존중하고 이해하여 원만한 관계를 형성하며, 타인을 위하여 기꺼이 나누어 주고자 하는 태도와 행동',
      },
      {
        key: 'integrity_compliance',
        label: '성실성과 규칙준수',
        definition: '책임감을 바탕으로 자신의 의무를 다하고, 공동체의 기본 윤리와 원칙을 준수하는 태도',
      },
      {
        key: 'leadership',
        label: '리더십',
        definition: '공동체의 목표 달성을 위해 구성원들의 상호작용을 이끌어가는 능력',
      },
    ],
  },
]

/**
 * 대학별 평가요소(확장형). 실제 공개 출처를 인용할 수 있는 검증 데이터만 채운다.
 * 날조 금지 — 출처가 불확실하면 비워 두고 `universityCriteria()`가 null을
 * 반환해 caller가 정직하게 폴백하게 한다.
 */
export interface UniversityCriteria {
  id: string
  name: string
  /** 그 대학의 평가 체계/방향(검증된 1줄) */
  evaluationFraming: string
  /** 세부 요소(검증된 것만) */
  evaluationItems?: string[]
  /** 권장과목/이수 관련(검증된 것만, 없으면 생략) */
  recommendedNote?: string
  /** 공개 출처로 검증됐는지 */
  verified: boolean
  /** 인용 출처(모집요강/시행계획 등). 비검증 항목 추가 금지. */
  source: string
}

export const UNIVERSITY_CRITERIA: UniversityCriteria[] = [
  {
    id: 'snu',
    name: '서울대학교',
    evaluationFraming: '학생부 항목별 반영비율 없이 학업능력·학업태도·학업외 소양을 종합 정성평가',
    evaluationItems: ['학업능력', '학업태도', '학업외 소양'],
    recommendedNote:
      '현행 권장: 인문계열=제2외국어/한문, 자연계열=수학 기하·미적분Ⅱ·과학 진로선택 (2028학년도부터 전공연계 과목선택 안내로 통합·세부는 모집요강 확인)',
    verified: true,
    source: 'https://admission.snu.ac.kr/undergraduate/notice',
  },
  {
    id: 'yonsei',
    name: '연세대학교',
    evaluationFraming:
      '공동연구 표준 3역량(학업역량·진로역량·공동체역량)으로 서류 종합 정성평가(활동우수형 등 유형 운영)',
    evaluationItems: ['학업역량', '진로역량', '공동체역량'],
    verified: true,
    source: 'https://www2.yonsei.ac.kr/entrance/',
  },
  {
    id: 'korea',
    name: '고려대학교',
    evaluationFraming: '인재상 3유형(인성·개척정신·논리/분석력)으로 평가, 2027학년도부터 계열별 선발',
    evaluationItems: ['인성', '개척정신', '논리·분석력'],
    verified: true,
    source: 'https://oku.korea.ac.kr',
  },
  {
    id: 'skku',
    name: '성균관대학교',
    evaluationFraming: '2026 기준 학업역량 40% · 탐구역량 40% · 잠재역량 20% (융합형·탐구형, 서류 100%)',
    evaluationItems: [
      '학업역량(학업수월성·학업충실성)',
      '탐구역량(탐구확장성·탐구주도성)',
      '잠재역량(미래성장성·공동체의식)',
    ],
    verified: true,
    source: 'https://admission.skku.edu',
  },
  {
    id: 'hanyang',
    name: '한양대학교',
    evaluationFraming:
      '학업역량·진로역량·공동체역량을 횡단평가(세특·창체·행특을 영역 교차 검증해 누적·일관된 성장을 확인)',
    evaluationItems: ['학업역량', '진로역량', '공동체역량'],
    recommendedNote: '특징: 횡단평가 — 화려한 스펙보다 누적된 노력·지속 성장',
    verified: true,
    source: 'https://go.hanyang.ac.kr',
  },
]

export function universityCriteria(id: string): UniversityCriteria | null {
  return UNIVERSITY_CRITERIA.find((u) => u.id === id) ?? null
}

/**
 * 통용 약칭 → KB id. 정확 일치(공백 제거 후)만 허용 — 부분일치는
 * 오매칭(예: '서울대' ⊂ '서울대입구', '서울시립대') 위험이 있어 금지.
 */
const UNIVERSITY_ALIASES: Record<string, string[]> = {
  snu: ['서울대학교', '서울대'],
  yonsei: ['연세대학교', '연세대'],
  korea: ['고려대학교', '고려대'],
  skku: ['성균관대학교', '성균관대'],
  hanyang: ['한양대학교', '한양대'],
}

/**
 * 사용자 입력 대학명 → KB 항목. 미수록이면 null — caller는 정직 폴백
 * (미수록 안내 + 모집요강 확인)으로 처리해야 하며, 날조 금지.
 */
export function matchUniversity(name: string): UniversityCriteria | null {
  const n = name.replace(/\s+/g, '')
  if (!n) return null
  for (const u of UNIVERSITY_CRITERIA) {
    const aliases = UNIVERSITY_ALIASES[u.id] ?? [u.name]
    if (aliases.includes(n)) return u
  }
  return null
}
