// Pullim Admissions Coach — 2024 미반영 항목 '신설 추천' 검출 가드 (#20)
// 순수 함수. Phase D 서버 guardrail-scanner가 재사용. prompt §4.7 NG와 동일 소스.
// 금지: 미반영 항목을 '새로 하라'는 추천. 허용: 기존 기록을 근거로 인용.

// 미반영 항목 토큰. '자율동아리'만 — 정규/정식 동아리는 반영이므로 제외.
const TERM =
  '(?:독서(?:활동)?|자율\\s*동아리|수상(?:\\s*경력|\\s*실적)?|대회\\s*수상|봉사(?:활동)?\\s*실적|개인\\s*봉사(?:활동)?|영재(?:\\s*교육)?(?:원)?|발명(?:\\s*교육)?)';

// 추천(신설/늘리기) 동사. '연결/정리/살리/드러내' 등 인용·정리 동사는 제외.
// '시작'·'준비' 제거 — 오탐률 높고 변별력 낮음 (FIX 1).
const VERB =
  '(?:추가|더\\s*읽|읽어|신설|새로\\s*만들|만들|참가|참여|쌓|해\\s*보)';

// 인용-전환 마커: 미반영 항목을 '세특·탐구·발표' 등 반영 출력물로 전환하는 맥락 → 신설 추천 아님.
const CITATION_MARKER_RE = /세특|탐구|발표|진로활동|교과|연계/;

// 미반영 항목 토큰과 추천 동사가 한 줄에서 15자 이내로 근접하면(어느 순서든) 신설 추천으로 본다.
// 'g' 미부착 — 직접 .test() 호출이 안전하도록. matchAll용 global 인스턴스는 find 내부에서 생성.
export const UNREFLECTED_RECOMMENDATION_RE = new RegExp(
  `${TERM}[^.\\n]{0,15}${VERB}|${VERB}[^.\\n]{0,15}${TERM}`
);

export function findUnreflectedRecommendations(text: string): string[] {
  // 'g' 정규식 재사용 시 lastIndex 오염 방지 위해 매 호출 새 인스턴스 사용.
  const re = new RegExp(UNREFLECTED_RECOMMENDATION_RE.source, 'g');
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    // 인용-전환 맥락(미반영 항목 → 세특·탐구·발표 등)은 신설 추천이 아니므로 제외 (FIX 1).
    if (CITATION_MARKER_RE.test(m[0])) continue;
    out.push(m[0]);
  }
  return out;
}

export function flagsUnreflectedRecommendation(text: string): boolean {
  return findUnreflectedRecommendations(text).length > 0;
}
