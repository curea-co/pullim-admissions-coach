import type { CohortResult, CohortSystem } from '@pullim/shared';

/**
 * 입시 로드맵 (deterministic).
 *
 * cohort + 학년(+선택 monthHint) → 학종 일반 타임라인 + 시기별 할 일.
 * Date.now()/random 미사용. 동일 입력 → 동일 출력.
 *
 * ★ 정직성: focus 항목은 학종-합법 영역(세특·정규 창체·면접 준비 등)만 담는다.
 *   폐지된 자소서·사교육·소논문 등은 절대 포함하지 않는다.
 */
export interface RoadmapPhase {
  /** 'record_build' | 'apply' | 'interview' | 'csat' | 'final' */
  key: string;
  /** '생기부 빌드' | '수시 원서' | '면접' | '수능' | '정시' */
  label: string;
  /** '고1–2 연중' | '9월' | '10–11월' | '11월' | '12월~' */
  window: string;
  /** 시기별 할 일(학종 관점, 합법 영역 위주) */
  focus: string[];
  /** 현재 학년/시기 기준 강조 단계인지 */
  active: boolean;
}

export interface Roadmap {
  admissionYear: number;
  system: CohortSystem;
  phases: RoadmapPhase[];
  note: string;
}

const COHORT_NOTE: Record<CohortSystem, string> = {
  '2027_old':
    '2027 구체제: 선택형 수능(국어·수학 선택과목)·내신 9등급제. 정량 변별이 상대적으로 큰 구조입니다.',
  '2028_new':
    '2028 신체제: 통합형 수능·내신 5등급제로 정량 변별이 줄어, 세특 중심 정성평가의 가중이 커지는 구조입니다.',
  '2029_new':
    '2029 신체제: 통합형 수능·내신 5등급제로 정량 변별이 줄어, 세특 중심 정성평가의 가중이 커지는 구조입니다.',
};

export function buildRoadmap(cohort: CohortResult, grade: number, monthHint?: number): Roadmap {
  // monthHint는 시그니처 안정성을 위해 받되 active 판정에는 사용하지 않는다
  // (학년이 시기를 결정 — Date 미사용·완전 결정적). 향후 학년 내 미세 강조에 활용 여지.
  void monthHint;

  const isGrade3 = grade >= 3;
  // 대입 학년도는 입학연도(=cohort)가 고정한다. cohort.system 자체가 입학연도+3(대입 학년도)을
  // 인코딩하므로(2025입학→2028_new→대입 2028) 학년으로 다시 가산하지 않는다.
  // grade는 '연도'가 아니라 '현재 강조 단계(active)'만 결정한다.
  const admissionYear = baseGradYear(cohort.system);

  const phases: RoadmapPhase[] = [
    {
      key: 'record_build',
      label: '생기부 빌드',
      window: '고1–2 연중',
      focus: [
        '교과 세특: 수업 내 탐구·발표·보고서로 학업역량을 일관되게 축적',
        '정규 창의적 체험활동(자율·동아리·진로) 내 활동을 진로와 연결',
        '관심 분야 독서·탐구를 수업 활동과 자연스럽게 연계',
      ],
      active: !isGrade3,
    },
    {
      key: 'apply',
      label: '수시 원서',
      window: '고3 8–9월',
      focus: [
        '학생부 마감 전 최종 점검(세특·창체 기록의 일관성 확인)',
        '지원 대학·전형 조합 설계(학종/교과/논술 등 균형)',
        '제출 서류·일정 체크리스트 관리',
      ],
      active: isGrade3,
    },
    {
      key: 'interview',
      label: '면접',
      window: '10–11월',
      focus: [
        '제출한 학생부 기반 예상 질문 정리·모의 응답 연습',
        '전공 적합성·지원 동기를 자기 활동으로 설명하는 훈련',
      ],
      active: isGrade3,
    },
    {
      key: 'csat',
      label: '수능',
      window: '11월',
      focus: [
        '수능 최저학력기준 충족 대비 마무리 학습',
        '실전 시간 운영·컨디션 관리',
      ],
      active: isGrade3,
    },
    {
      key: 'final',
      label: '정시',
      window: '12월~',
      focus: [
        '수능 성적 기반 정시 지원 전략 점검(가·나·다군 조합)',
        '수시 결과와 연동한 최종 의사결정',
      ],
      active: isGrade3,
    },
  ];

  return {
    admissionYear,
    system: cohort.system,
    phases,
    note: COHORT_NOTE[cohort.system],
  };
}

/** 체제별 대표(고3) 대입연도. 체제 식별자에 내장된 연도를 그대로 사용. */
function baseGradYear(system: CohortSystem): number {
  if (system === '2027_old') return 2027;
  if (system === '2028_new') return 2028;
  return 2029;
}
