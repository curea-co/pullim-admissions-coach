import type { PrescribedAction, EvidenceRef } from '@pullim/shared';

/**
 * 종단 "생기부 디지털 트윈" diff 엔진 (moat #2 = 닫힌 루프).
 *
 * 한 학기에 합법 처방을 내리면, 다음 학기에 그 처방이 실제로 생기부에 "안착"했는지를
 * 결정론적으로 대조한다. (LLM 판정은 향후 확장 — 본 모듈은 순수·테스트 가능·네트워크 불요.)
 *
 * 부수효과 없음. Date/random 사용 안 함. 입력 순서 보존.
 */

/** 안착 판정 임계값. 액션 토큰 중 다음-학기 인용에 등장한 비율이 이 값 이상이면 landed. */
export const LAND_THRESHOLD = 0.34;

/** 한 학기의 코칭 상태를, diff에 필요한 만큼으로 축약한 스냅샷. */
export interface Snapshot {
  term: string; // 예: "고2-1"
  actions: PrescribedAction[]; // 그 학기에 처방한 항목(rubric.items)
  evidence: EvidenceRef[]; // 그 학기에 관측된 모든 증거 인용(진단 + 루브릭)
}

export type LandedStatus = 'landed' | 'pending';

export interface ActionOutcome {
  action: PrescribedAction;
  status: LandedStatus;
  matchedQuote: string | null; // landed라면 충족시킨 다음-학기 인용, 아니면 null
  score: number; // 겹침 점수 0..1 (투명성/임계값 튜닝용)
}

export interface TwinDiff {
  from: string; // prev.term
  to: string; // next.term
  outcomes: ActionOutcome[]; // prev.action당 1건: 다음 학기에 안착했는가?
  newEvidence: EvidenceRef[]; // next에는 있으나 prev에는 없는 증거(정규화 인용 기준)
  summary: { landed: number; pending: number; landedRate: number; newEvidence: number };
}

/**
 * 한국어 굴절 정규화용 휴리스틱 어미/조사 목록.
 *
 * ⚠️ 휴리스틱 스테머다 — 완전한 형태소 분석이 아니다(범위 밖). 굴절형이 같은
 * 어간으로 수렴하도록(예: 회귀분석을 / 회귀분석으로 / 회귀분석 → 회귀분석) 토큰의
 * "가장 긴 매칭 후행 조사/어미"를 1겹만 벗긴다. 향후 의미적 안착 판정은 LLM judge로 확장.
 *
 * 보수성 규칙(false merge 방지):
 *  - 토큰 길이 ≥3(한글)일 때만 시도 → 벗긴 뒤 어간이 ≥2 한글 글자로 남는 경우만 적용.
 *  - latin/digit가 섞인 토큰은 손대지 않는다(전부 한글일 때만).
 *  - 가장 긴 접미만 1겹 벗긴다(재귀 박리 없음). '으로' 같은 2자가 '로'보다 우선.
 */
const KO_SUFFIXES: readonly string[] = [
  // 조사(particles)
  '에게서', '에서', '에게', '한테', '으로', '라도', '처럼', '마다', '조차', '밖에',
  '부터', '까지', '보다',
  '을', '를', '은', '는', '이', '가', '와', '과', '도', '만', '에', '로', '의', '께',
  // 어미/명사화·접미(verb/adj endings & nominalizers) — 흔한 것만 실용적으로
  '되었다', '습니다', 'ㅂ니다', '입니다', '하였다', '하면서',
  '되어', '되며', '하고', '하며', '하여', '해서', '했다', '했음', '했고', '하기',
  '하는', '하게', '였다', '이다', '한다',
  '한', '할', '함', '임', '됨',
];
// 길이 내림차순 정렬 → "가장 긴 매칭" 보장(예: '으로' > '로', '에서' > '에').
const KO_SUFFIXES_SORTED = [...KO_SUFFIXES].sort((a, b) => b.length - a.length);

const HANGUL_RE = /^[가-힣]+$/;

/**
 * 단일 토큰 정규화: 전부 한글이고 길이 ≥3인 경우에 한해, 가장 긴 매칭 후행
 * 조사/어미를 1겹 벗긴다. 단, 벗긴 어간이 ≥2 한글 글자일 때만 적용한다.
 * 그 외(latin/digit 포함, 길이<3, 어간이 너무 짧아짐)는 토큰을 그대로 둔다.
 */
function normalizeToken(t: string): string {
  if (t.length < 3 || !HANGUL_RE.test(t)) return t;
  for (const suf of KO_SUFFIXES_SORTED) {
    if (suf.length >= t.length) continue; // 어간이 비거나 음수가 되는 접미는 건너뜀
    if (t.endsWith(suf)) {
      const stem = t.slice(0, t.length - suf.length);
      if (stem.length >= 2) return stem; // 어간 ≥2 한글 글자일 때만 박리
      return t; // 어간이 1글자면 박리하지 않음(과박리 방지)
    }
  }
  return t;
}

/**
 * 토큰화: 한국어는 대소문자가 무의미하나 latin 토큰을 위해 lowercase 적용.
 * 공백/구두점 등 non-word 문자로 분할하고, 각 토큰에 한국어 형태소 정규화(normalizeToken)를
 * 적용한 뒤, 최종 길이 ≥2 토큰만 유지(1-char 토큰은 드롭).
 * 한국어는 굴절 어미/조사가 벗겨진 어간이 토큰이 되고, latin/digit 단어는 그대로 토큰이 된다.
 */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    // 한글/영문/숫자가 아닌 문자를 구분자로 사용
    .split(/[^0-9a-z가-힣㄰-㆏]+/)
    .map(normalizeToken)
    .filter((t) => t.length >= 2);
}

/** 공백 제거 정규화(인용 동일성 비교용). */
function stripWs(s: string): string {
  return s.replace(/\s+/g, '');
}

/**
 * 액션 안착 점수: 액션 텍스트 + 액션 evidence.quote의 distinct 토큰 중,
 * 주어진 인용(quote) 토큰 집합에 등장하는 토큰의 비율.
 * 분모가 0이면 0(빈 액션 보호).
 */
function overlapScore(actionTokens: Set<string>, quoteTokens: Set<string>): number {
  if (actionTokens.size === 0) return 0;
  let hit = 0;
  for (const t of actionTokens) if (quoteTokens.has(t)) hit++;
  return hit / actionTokens.size;
}

/** prev 처방이 next 증거에 실제로 안착했는지를 결정론적으로 대조한다. */
export function diffSnapshots(prev: Snapshot, next: Snapshot): TwinDiff {
  // next 증거별 토큰 집합 사전계산(순서 보존).
  const nextQuoteTokens = next.evidence.map((e) => ({
    quote: e.quote,
    tokens: new Set(tokenize(e.quote)),
  }));

  const outcomes: ActionOutcome[] = prev.actions.map((action) => {
    // 액션 텍스트 + 액션 자체 evidence.quote 토큰을 합쳐 distinct 집합 구성.
    const actionTokens = new Set([...tokenize(action.text), ...tokenize(action.evidence.quote)]);

    let bestScore = 0;
    let bestQuote: string | null = null;
    for (const nq of nextQuoteTokens) {
      const score = overlapScore(actionTokens, nq.tokens);
      if (score > bestScore) {
        bestScore = score;
        bestQuote = nq.quote;
      }
    }

    const landed = bestScore >= LAND_THRESHOLD;
    return {
      action,
      status: landed ? 'landed' : 'pending',
      matchedQuote: landed ? bestQuote : null,
      score: bestScore,
    };
  });

  // newEvidence: 정규화(공백 제거) 인용이 prev 증거 집합에 없는 next 증거(순서 보존).
  const prevQuoteSet = new Set(prev.evidence.map((e) => stripWs(e.quote)));
  const newEvidence = next.evidence.filter((e) => !prevQuoteSet.has(stripWs(e.quote)));

  const landed = outcomes.filter((o) => o.status === 'landed').length;
  const pending = outcomes.length - landed;
  // landedRate = landed / max(1, 총 액션 수), 소수 2자리 반올림(0 나눗셈 보호).
  const landedRate = Math.round((landed / Math.max(1, prev.actions.length)) * 100) / 100;

  return {
    from: prev.term,
    to: next.term,
    outcomes,
    newEvidence,
    summary: { landed, pending, landedRate, newEvidence: newEvidence.length },
  };
}
