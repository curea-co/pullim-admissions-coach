import type { AnalyzeResult } from './analyze'

/**
 * 키 없이 결과 UI를 검토할 수 있는 현실적 샘플.
 * coach-visual.html 의 김서연·고2·2028 신체제·사회계열 예시를 그대로 재현하며,
 * 자동 제외(stripped) 1~2건을 포함한다. 타입은 @/lib/analyze 의 AnalyzeResult 와 정확히 일치.
 */
export const SAMPLE_RESULT: AnalyzeResult = {
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
