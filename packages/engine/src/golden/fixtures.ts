import type { ActionCandidate } from '../types'

export interface GoldenCase {
  name: string
  admissionYear: number
  region: 'metro' | 'non_metro' | 'unknown'
  /** LLM이 제안한 후보 — 의도적으로 금지항목을 섞어 게이트를 검증 */
  candidates: ActionCandidate[]
}

const ev = (q: string) => ({ quote: q, section: '세특' })

export const GOLDEN_CASES: GoldenCase[] = [
  {
    name: 'case-01 박준호(자연/수도권/2024 고3 구체제)',
    admissionYear: 2024, region: 'metro',
    candidates: [
      { recordArea: 'SETUK', competency: 'ACADEMIC', text: '미적분 함수 극한 심화 탐구', rationale: '약점 보완', evidence: ev('미적분') },
      { recordArea: 'AWARD', competency: 'ACADEMIC', text: '수학경시대회 수상 추천', rationale: '경쟁력', evidence: ev('수학') }, // ❌ 제거되어야
    ],
  },
  {
    name: 'case-02 김서연(인문/비수도권/2025 고2 신체제)',
    admissionYear: 2025, region: 'non_metro',
    candidates: [
      { recordArea: 'CREATIVE_REGULAR', competency: 'CAREER', text: '진로 연계 독서토론 정규동아리 활동', rationale: '진로역량', evidence: ev('독서토론') },
      { recordArea: 'READING', competency: 'CAREER', text: '독서활동 제목 다수 기재', rationale: 'x', evidence: ev('책') }, // ❌
      { recordArea: 'SETUK', competency: 'COMMUNITY', text: '소논문 작성', rationale: 'x', evidence: ev('탐구') }, // ⛔ 키워드
    ],
  },
  {
    name: 'case-03 이도윤(공학/수도권/2026 고1 신체제)',
    admissionYear: 2026, region: 'metro',
    candidates: [
      { recordArea: 'SETUK', competency: 'ACADEMIC', text: '물리 역학 실험 설계 세특 심화', rationale: 'x', evidence: ev('물리') },
      { recordArea: 'BEHAVIOR', competency: 'COMMUNITY', text: '협업 리더십 행동 방향', rationale: 'x', evidence: ev('모둠') },
      { recordArea: 'SETUK', competency: 'ACADEMIC', text: '깨끗한 탐구 활동', rationale: 'x', evidence: ev('소논문 발표 실적') }, // ⛔ evidence.quote 키워드 → 제거
    ],
  },
  {
    name: 'case-04 최하은(사회/비수도권/2024 고3 구체제)',
    admissionYear: 2024, region: 'non_metro',
    candidates: [
      { recordArea: 'SETUK', competency: 'CAREER', text: '사회문화 통계 분석 세특', rationale: 'x', evidence: ev('통계') },
      { recordArea: 'PRIVATE_EDU', competency: 'ACADEMIC', text: '학원 특강 수강', rationale: 'x', evidence: ev('x') }, // ⛔ 영역+키워드
    ],
  },
  {
    name: 'case-05 박민준(예체능/수도권/2025 고2 신체제)',
    admissionYear: 2025, region: 'metro',
    candidates: [
      { recordArea: 'CREATIVE_REGULAR', competency: 'CAREER', text: '미술 정규동아리 작품 활동', rationale: 'x', evidence: ev('미술') },
      { recordArea: 'GIFTED', competency: 'ACADEMIC', text: '영재교육 실적', rationale: 'x', evidence: ev('x') }, // ❌
      { recordArea: 'SETUK', competency: 'ACADEMIC', text: 'R & E 프로젝트 참여 권장', rationale: 'x', evidence: ev('탐구') }, // ⛔ 띄어쓰기 변형 → 제거
    ],
  },
]
