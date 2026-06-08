// 종단 트윈 판정기(twin judge) false-positive 적대 테스트 스위트.
//
// 각 케이스는 두 학기(priorSaengbu + saengbu) 요청 바디다. 설계상 현재 생기부는
// 이전 학기 처방을 "진짜로" 반영하지 않는다 — 따라서 올바른 판정기는 대부분 outcome 을
// `pending` 으로 둬야 한다. 어떤 outcome 이 현재 생기부 근거 없이 `landed` 면 = false positive.
//
// 포함: distractor 케이스 — 현재 생기부가 처방과 표면 키워드만 공유하고 실제로는 다른 활동을 서술.
//
// 사용법: 각 케이스를 /api/analyze 에 POST → response.twin.outcomes 검사.
//   evaluateJudge(twin) → { total, landed, falsePositiveCandidates }
// (landed 된 outcome 은 모두 false-positive 후보다 — 본 스위트는 안착이 일어나면 안 되도록 구성됨.)

const consent = { sensitive: true, guardian: false }

export const JUDGE_CASES = [
  // 1) 현재 학기에 처방 주제와 전혀 무관한 활동만 등장 → 모두 pending 이어야.
  {
    id: 'judge-unrelated-next-term',
    label: '판정/다음학기 무관활동',
    body: {
      admissionYear: 2025,
      track5: 'social',
      targetRegion: 'metro',
      schoolType: 'general',
      grade: 2,
      consent,
      priorTerm: '고2-1',
      currentTerm: '고2-2',
      priorSaengbu:
        '경제: 물가지수 변화를 자료로 정리했으나 인과와 상관을 혼동함. ' +
        '통합사회: 소득 분배 지표를 그래프로 표현함.',
      saengbu:
        '체육: 농구 리그에서 팀 전술을 제안하고 포지션을 조율함. ' +
        '음악: 합창 발표에서 베이스 파트를 맡아 화음을 안정시킴. ' +
        '미술: 풍경 수채화에서 색 배합을 실험함.',
    },
    expect: { note: '이전 학기 처방(경제·자료해석)과 무관한 예체능 활동만. landed 0 기대 → landed면 FP.' },
  },

  // 2) ★distractor — 표면 키워드("회귀분석","경제") 공유하나 실제로는 다른 활동.
  {
    id: 'judge-distractor-keyword-overlap',
    label: '★판정/표면키워드 distractor',
    body: {
      admissionYear: 2025,
      track5: 'social',
      targetRegion: 'metro',
      schoolType: 'general',
      grade: 2,
      consent,
      priorTerm: '고2-1',
      currentTerm: '고2-2',
      priorSaengbu:
        '경제: 지역 물가지수를 회귀분석으로 분석하여 인과 구조를 해석하는 탐구를 진행함.',
      // 현재: "회귀분석" "경제" 단어는 나오지만, 학생이 직접 분석한 게 아니라
      // 수업에서 용어를 들었다는 수동적 서술 + 다른 과목 맥락.
      saengbu:
        '수학: 수업 중 교사가 회귀분석이라는 용어를 소개하는 것을 들음. ' +
        '국어: 경제 관련 신문 기사를 읽고 어휘를 정리함. ' +
        '진로활동: 직업 강연을 청취함.',
    },
    expect: {
      note: '★핵심. 회귀분석·경제 키워드가 표면적으로 겹치지만 학생의 능동적 탐구 안착이 아님(수동 청취·어휘정리). landed면 false positive.',
    },
  },

  // 3) 처방 주제를 "하겠다"는 계획만 있고 실행 증거 없음 → pending.
  {
    id: 'judge-plan-not-evidence',
    label: '판정/계획만 있고 실행없음',
    body: {
      admissionYear: 2026,
      track5: 'natural',
      targetRegion: 'metro',
      schoolType: 'general',
      grade: 1,
      consent,
      priorTerm: '고1-1',
      currentTerm: '고1-2',
      priorSaengbu:
        '통합과학: 중화반응 실험에서 변인 통제 설계를 시도했으나 오차 분석이 미흡함.',
      saengbu:
        '통합과학: 다음에는 오차 분석을 더 정밀하게 해보고 싶다고 소감문에 적음. ' +
        '수학: 함수 단원 문제 풀이를 연습함.',
    },
    expect: { note: '"하고 싶다"는 의지 표명만, 실제 오차 분석 실행 증거 없음. landed면 FP.' },
  },

  // 4) 동일 과목이지만 완전히 다른 단원·역량으로 이동 → pending.
  {
    id: 'judge-same-subject-different-topic',
    label: '판정/같은과목 다른주제',
    body: {
      admissionYear: 2025,
      track5: 'engineering',
      targetRegion: 'non_metro',
      schoolType: 'general',
      grade: 2,
      consent,
      priorTerm: '고2-1',
      currentTerm: '고2-2',
      priorSaengbu:
        '물리학: 단진동 주기 측정 실험에서 측정 도구의 한계를 인식하고 오차를 줄이는 방법을 제안함.',
      saengbu:
        '물리학: 전자기 유도 단원에서 코일과 자석의 상대 운동 개념을 그림으로 정리함(주기·오차 분석과 무관). ' +
        '정보: HTML 페이지 레이아웃을 작성함.',
    },
    expect: { note: '같은 물리학이지만 단진동·오차 처방과 무관한 전자기 단원. landed면 FP.' },
  },

  // 5) 현재 생기부가 거의 비어 있음(sparse) → 안착 근거 없음.
  {
    id: 'judge-sparse-next-term',
    label: '판정/현재학기 sparse',
    body: {
      admissionYear: 2024,
      track5: 'humanities',
      targetRegion: 'unknown',
      schoolType: 'general',
      grade: 3,
      consent,
      priorTerm: '고3-1',
      currentTerm: '고3-2',
      priorSaengbu:
        '국어: 비평문에서 화자의 신뢰성 문제를 근거를 들어 분석하고 토론을 주도함.',
      saengbu: '국어: 수업에 참여함. 출결 양호.',
    },
    expect: { note: '현재 생기부에 비평·토론 안착 증거가 전혀 없음(빈약). landed면 FP.' },
  },

  // 6) 부정/반례 — 처방을 시도했으나 실패·중단했다는 서술 → pending.
  {
    id: 'judge-attempted-then-abandoned',
    label: '판정/시도후 중단',
    body: {
      admissionYear: 2025,
      track5: 'social',
      targetRegion: 'non_metro',
      schoolType: 'general',
      grade: 2,
      consent,
      priorTerm: '고2-1',
      currentTerm: '고2-2',
      priorSaengbu:
        '정치와법: 판례를 읽고 쟁점을 정리했으나 반대 논거 검토가 부족함.',
      saengbu:
        '정치와법: 반대 논거를 검토하는 토론을 준비하다가 자료 부족으로 발표를 포기하고 다른 조원의 주제로 대체함. ' +
        '수학: 통계 단원 과제를 제출함.',
    },
    expect: { note: '반대논거 검토를 시도했으나 포기·대체. 실제 안착 아님. landed면 FP.' },
  },
]

/**
 * twin.outcomes 를 검사해 false-positive 후보(=landed) 를 센다.
 * 본 스위트는 모두 pending 이 정답이므로 landed 는 곧 false positive.
 * @param {{outcomes?: Array<{action:object,status:string,matchedQuote:string|null,score:number}>}|undefined} twin
 */
export function evaluateJudge(twin) {
  const outcomes = twin?.outcomes ?? []
  const landed = outcomes.filter((o) => o.status === 'landed')
  return {
    total: outcomes.length,
    landed: landed.length,
    falsePositiveCandidates: landed.map((o) => ({
      actionText: o.action?.text ?? '(unknown)',
      matchedQuote: o.matchedQuote,
      score: o.score,
    })),
  }
}
