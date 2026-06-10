import { diffSnapshots, buildRoadmap, type TwinDiff } from '@pullim/engine'
import type { AnalyzeResult } from './analyze'
import { assessFit } from './fit'
import { toSnapshot } from './twin'
import type { InterviewPack } from './ai/schemas'

/**
 * 키 없이 결과 UI를 검토할 수 있는 현실적 샘플.
 * coach-visual.html 의 김서연·고2·2028 신체제·사회계열 예시를 그대로 재현하며,
 * 자동 제외(stripped) 1~2건을 포함한다. 타입은 @/lib/analyze 의 AnalyzeResult 와 정확히 일치.
 */
/**
 * 면접 준비 팩(데모) — 손으로 작성하되, 모든 `basis.quote`는 김서연 샘플 생기부
 * (위 SAMPLE_RESULT.diagnosis.evidence)에 실제로 등장하는 인용만 사용한다.
 * answerDirection은 "방향"(핵심 논리·포인트)만이며 완성 대본/합격 답변이 아니다. 날조 금지.
 */
const SAMPLE_INTERVIEW: InterviewPack = {
  questions: [
    {
      question:
        '소득격차를 회귀분석해 정책 대안을 발표했다고 했는데, 분석 과정에서 가장 판단하기 어려웠던 지점과 그 한계는 무엇이었나요?',
      basis: {
        quote: '지역 소득격차를 회귀분석하고 정책 대안을 발표함',
        section: '세특(사회문화)',
      },
      answerDirection:
        '방향: 변수 선택·인과와 상관의 구분에서 무엇을 어떻게 판단했는지, 그리고 그 분석이 정책 제안으로 이어질 때의 한계(표본·외생변수 등)를 솔직히 짚는 쪽으로. 결과 자랑이 아니라 사고 과정을 드러내세요.',
      followups: [
        '상관과 인과를 어떻게 구분해 해석했나요?',
        '같은 분석을 다른 사회현상에 적용한다면 무엇을 바꾸겠습니까?',
      ],
    },
    {
      question:
        "'불평등의 사회학' 탐구보고서를 작성했는데, 보고서 이후 그 관심이 어떤 후속 활동으로 이어졌는지 설명해 주세요.",
      basis: {
        quote: "'불평등의 사회학' 탐구보고서 작성",
        section: '진로활동',
      },
      answerDirection:
        "방향: '관심 표명'에서 멈추지 않았음을 보여주는 게 핵심. 보고서에서 생긴 후속 질문, 검증하려 한 가설, 반론을 다뤄 본 경험을 연결해 '관심 → 역량'의 전환을 설명하세요. 아직 부족한 부분은 인정해도 됩니다.",
      followups: [
        '보고서를 쓰며 스스로 가장 약하다고 느낀 논거는 무엇이었나요?',
        '반대 입장에서 제기될 수 있는 비판은 어떤 것이라고 보나요?',
      ],
    },
    {
      question:
        '학급 토론에서 사회를 맡아 의견을 조율했다고 했는데, 의견이 첨예하게 갈렸을 때 무엇을 바꿔 합의에 가까워졌나요?',
      basis: {
        quote: '학급 토론 사회를 맡아 의견을 조율함',
        section: '자율활동',
      },
      answerDirection:
        "방향: 역할(사회자)이 아니라 '영향'(무엇을 바꿨는가)에 초점. 조율을 위해 시도한 구체적 행동과 그 결과(합의·갈등 완화)를 한 가지 사례로. 기여가 기록에 덜 드러난다는 약점을 스스로 메우는 답.",
      followups: [
        '끝내 합의되지 않은 지점은 어떻게 처리했나요?',
        '다시 같은 상황이라면 무엇을 다르게 하겠습니까?',
      ],
    },
  ],
}

const SAMPLE_RESULT_BASE: AnalyzeResult = {
  cohort: {
    system: '2028_new',
    track: 'core',
    region: 'metro',
    emphasizeSetuk: true,
  },
  diagnosis: {
    criteria: [
      {
        key: 'ACADEMIC',
        mapping: '학업역량 — 탐구력·정량 분석',
        strength: '통계·회귀로 사회현상을 정량 분석하는 탐구력이 돋보입니다.',
        weakness: '분석이 1개 과목(사회문화)에 집중되어 융합의 폭이 좁습니다.',
        evidence: [
          {
            quote: '지역 소득격차를 회귀분석하고 정책 대안을 발표함',
            section: '세특(사회문화)',
          },
          {
            quote: '통계 표본설계 개념을 적용해 설문 결과의 신뢰구간을 해석함',
            section: '세특(확률과통계)',
          },
        ],
      },
      {
        key: 'CAREER',
        mapping: '진로역량 — 전공 적합성·심화',
        strength: '사회학과 진학 목표가 활동과 일관되게 이어집니다.',
        weakness: "탐구가 '관심 표명'에 머물러 후속 심화로 이어지지 못했습니다.",
        evidence: [
          {
            quote: "'불평등의 사회학' 탐구보고서 작성",
            section: '진로활동',
          },
        ],
      },
      {
        key: 'COMMUNITY',
        mapping: '공동체역량 — 협업·기여',
        strength: '토론 사회를 맡아 의견을 조율한 협업 경험이 있습니다.',
        weakness: "협업의 '결과·기여'가 기록에 드러나지 않습니다.",
        evidence: [
          {
            quote: '학급 토론 사회를 맡아 의견을 조율함',
            section: '자율활동',
          },
        ],
      },
    ],
  },
  rubric: {
    cohort: {
      system: '2028_new',
      track: 'core',
      region: 'metro',
      emphasizeSetuk: true,
    },
    items: [
      {
        recordArea: 'SETUK',
        competency: 'ACADEMIC',
        text: '회귀분석을 다른 교과로 확장해 보세요.',
        rationale:
          "경제 '물가지수' 또는 확률과통계 '표본설계'와 연결해, 같은 분석 도구를 새 맥락에 적용한 탐구를 제안하세요. 단일 과목 편중이라는 약점을 직접 메웁니다.",
        evidence: {
          quote: '회귀분석…정책 대안을 발표함',
          section: '세특(사회문화)',
        },
      },
      {
        recordArea: 'CREATIVE_REGULAR',
        competency: 'CAREER',
        text: '탐구보고서를 후속 활동으로 이어가세요.',
        rationale:
          "'불평등' 주제를 정규 동아리 활동에서 한 단계 더 — 데이터로 검증하거나 반론을 다루는 후속 탐구로 발전시키면 '관심'이 '역량'으로 보입니다.",
        evidence: {
          quote: "'불평등의 사회학' 탐구보고서",
          section: '진로활동',
        },
      },
      {
        recordArea: 'BEHAVIOR',
        competency: 'COMMUNITY',
        text: "토론 사회에서 '무엇을 바꿨는지'를 남기세요.",
        rationale:
          '조율한 결과(합의 도출·갈등 해소 등 구체적 기여)가 드러나는 방향으로 활동하세요. 역할이 아니라 영향이 평가됩니다.',
        evidence: {
          quote: '의견을 조율함',
          section: '자율활동',
        },
      },
    ],
    uncertaintyNote:
      '이 진단·처방은 업로드된 생기부 근거에 기반한 해석이며, 합격 여부를 보장하지 않습니다. 최종 평가 기준은 대학별 시행계획을 직접 확인하세요. 제안은 모두 학생 본인이 앞으로 할 활동이며, 교사 기재영역을 대신 작성하지 않습니다.',
    stripped: [
      { recordArea: '교내 수학경시대회 수상 준비', reason: '수상경력 = 대입 미반영' },
      { recordArea: "'불평등' 관련 독서활동 다수 기재", reason: '독서활동 = 대입 미반영' },
      { recordArea: '사회 이슈 소논문(R&E) 작성', reason: '소논문 = 미기재·사교육 우려' },
    ],
  },
}

/**
 * 입시 코치 identity 산출물을 SAMPLE_RESULT에 부착(정직·일관).
 * - roadmap·fit는 REAL 엔진/lib으로 계산 — buildRoadmap(cohort, grade=2), assessFit('social', diagnosis).
 *   하드코딩이 아니라 실제 분석 경로와 동일한 산출이므로 데모와 실데이터가 어긋나지 않는다.
 * - interview는 손으로 작성하되 basis.quote는 모두 위 diagnosis 근거에 실제 등장하는 인용만 사용.
 * 김서연 · 고2 · 2028 신체제 · 사회계열.
 */
export const SAMPLE_RESULT: AnalyzeResult = {
  ...SAMPLE_RESULT_BASE,
  roadmap: buildRoadmap(SAMPLE_RESULT_BASE.cohort, 2),
  // 목표 대학 데모: KB 수록(연세대 = 검증 평가기준) + 미수록(한국교원대 = 정직 폴백) 둘 다 보여준다.
  fit: assessFit('social', SAMPLE_RESULT_BASE.diagnosis, ['연세대', '한국교원대학교']),
  interview: SAMPLE_INTERVIEW,
}

/**
 * 종단 트윈 데모용 "이전 학기"(고2-1) 상태.
 * SAMPLE_RESULT(고2-2)보다 EARLIER — 근거가 더 적고/약하며, 위 3개 처방이 아직 반영되기 전.
 * diffSnapshots(고2-1 → 고2-2)를 돌리면:
 *  - 회귀분석 확장 처방 = 반영됨(landed): 고2-2 근거 "지역 소득격차를 회귀분석하고 정책 대안을 발표함"이
 *    처방 토큰의 34% 이상을 충족.
 *  - 불평등 탐구보고서 처방 = 반영됨(landed): 고2-2 근거 "'불평등의 사회학' 탐구보고서 작성"과 토큰 다수 공유.
 *  - 봉사 동아리 리더 처방 = 아직 반영 전(pending): 고2-2 근거에 충분히 안착하지 못함.
 *  ⇒ landed 2 · pending 1 · 반영률 67%.
 * 김서연 · 고2 · 2028 신체제 · 사회계열 — 현실적 시나리오.
 */
export const SAMPLE_PREV: AnalyzeResult = {
  cohort: {
    system: '2028_new',
    track: 'core',
    region: 'metro',
    emphasizeSetuk: true,
  },
  diagnosis: {
    criteria: [
      {
        key: 'ACADEMIC',
        mapping: '학업역량 — 탐구력·정량 분석',
        strength: '사회현상을 자료로 분석하려는 태도가 보입니다.',
        weakness: '분석 도구가 단일 과목에 머물러 정량 탐구의 깊이가 얕습니다.',
        evidence: [
          {
            quote: '사회문화 시간에 소득격차 자료를 표로 정리해 발표함',
            section: '세특(사회문화)',
          },
        ],
      },
      {
        key: 'CAREER',
        mapping: '진로역량 — 전공 적합성·심화',
        strength: '사회 불평등 주제에 꾸준한 관심을 보입니다.',
        weakness: '관심이 보고서 한 편에 그쳐 후속 심화가 없습니다.',
        evidence: [
          {
            quote: '불평등 관련 진로 희망을 발표함',
            section: '진로활동',
          },
        ],
      },
      {
        key: 'COMMUNITY',
        mapping: '공동체역량 — 협업·기여',
        strength: '학급 활동에 성실히 참여합니다.',
        weakness: '협업에서 맡은 역할·기여가 구체적으로 드러나지 않습니다.',
        evidence: [
          {
            quote: '학급 행사 준비에 참여함',
            section: '자율활동',
          },
        ],
      },
    ],
  },
  rubric: {
    cohort: {
      system: '2028_new',
      track: 'core',
      region: 'metro',
      emphasizeSetuk: true,
    },
    items: [
      {
        recordArea: 'SETUK',
        competency: 'ACADEMIC',
        // landed 예상: 고2-2 근거 "지역 소득격차를 회귀분석하고 정책 대안을 발표함"과 토큰 다수 공유.
        text: '소득격차를 회귀분석하고 정책 대안을 발표해 보세요.',
        rationale:
          '표 정리 수준의 분석을 회귀분석으로 끌어올려 단일 도구 편중이라는 약점을 메우세요.',
        evidence: {
          quote: '소득격차 자료를 표로 정리해 발표함',
          section: '세특(사회문화)',
        },
      },
      {
        recordArea: 'CREATIVE_REGULAR',
        competency: 'CAREER',
        // landed 예상: 고2-2 근거 "'불평등의 사회학' 탐구보고서 작성"과 토큰 다수 공유.
        text: "'불평등의 사회학' 탐구보고서 작성으로 심화하세요.",
        rationale:
          "진로 희망 발표에 머문 관심을, 주제 탐구보고서 작성으로 한 단계 심화하면 '관심'이 '역량'으로 보입니다.",
        evidence: {
          quote: '불평등의 사회학 주제로 탐구함',
          section: '진로활동',
        },
      },
      {
        recordArea: 'BEHAVIOR',
        competency: 'COMMUNITY',
        // pending 예상: 고2-2 근거에 충분히 안착하지 못함(역할/기여 기록 미반영).
        text: '봉사 동아리에서 리더 역할을 맡아 운영 기여를 남기세요.',
        rationale:
          '단순 참여를 넘어, 직접 맡은 역할과 운영 기여가 기록에 드러나도록 활동하세요. 역할이 아니라 영향이 평가됩니다.',
        evidence: {
          quote: '학급 행사 준비에 참여함',
          section: '자율활동',
        },
      },
    ],
    uncertaintyNote:
      '이 진단·처방은 업로드된 생기부 근거에 기반한 해석이며, 합격 여부를 보장하지 않습니다. 최종 평가 기준은 대학별 시행계획을 직접 확인하세요. 제안은 모두 학생 본인이 앞으로 할 활동이며, 교사 기재영역을 대신 작성하지 않습니다.',
    stripped: [
      { recordArea: '교내 토론대회 수상 준비', reason: '수상경력 = 대입 미반영' },
      { recordArea: '불평등 관련 독서활동 기재', reason: '독서활동 = 대입 미반영' },
    ],
  },
}

/**
 * 데모에서 바로 쓰는, 엔진으로 계산한 학기 비교 결과(고2-1 → 고2-2).
 * 결정론적 순수 함수 산출 — 클라이언트에서 재계산해도 동일.
 */
export const SAMPLE_TWIN_DIFF: TwinDiff = diffSnapshots(
  toSnapshot('고2-1', SAMPLE_PREV),
  toSnapshot('고2-2', SAMPLE_RESULT),
)
