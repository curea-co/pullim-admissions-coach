// #16(sales-ceo 폐쇄루프 revamp)에서 흡수 — §6.2 합법성 게이트.
// LLM이 무엇을 제안하든 대입-반영(✅) 영역 + 증거 있는 것만 통과시키는 *출력 최후 필터*.
// 미래 AI 처방 파이프라인용. (main의 guardrails/unreflected-activities 보강)

/** §6.2 대입-반영 = 처방 허용 영역 (이것만 RecordArea로 인정) */
export type AllowedRecordArea = 'SETUK' | 'CREATIVE_REGULAR' | 'BEHAVIOR';
export const ALLOWED_RECORD_AREAS: readonly AllowedRecordArea[] = [
  'SETUK',
  'CREATIVE_REGULAR',
  'BEHAVIOR',
];

/** ❌ 미반영 + ⛔ 미기재 = 처방/언급 금지 (LLM이 제안하면 게이트가 제거) */
export const FORBIDDEN_RECORD_AREAS = [
  'AWARD', 'AUTONOMOUS_CLUB', 'VOLUNTEER_EXTERNAL', 'READING', 'CERTIFICATE', 'GIFTED',
  'RESEARCH_PAPER', 'EXTERNAL_AWARD', 'PRIVATE_EDU', 'PARENT_BACKGROUND',
] as const;

/** ⛔ 언급 자체 금지 키워드(텍스트 스캔용) */
export const FORBIDDEN_KEYWORDS = ['소논문', 'R&E', '교외 수상', '학원', '컨설팅'] as const;

// 엔진 표기 역량(대문자) — diagnosis.ts의 Competency(소문자 3역량)와 분리하기 위해 export 하지 않음.
type LegalityCompetency = 'ACADEMIC' | 'CAREER' | 'COMMUNITY';

export interface EvidenceRef {
  quote: string;
  section: string;
}

/** LLM이 제안하는 처방 후보(검증 전) */
export interface ActionCandidate {
  recordArea: string; // 임의 문자열 — 게이트가 검증
  competency: LegalityCompetency;
  text: string;
  rationale: string;
  evidence: EvidenceRef | null;
}

/** 게이트 통과 + 조립된 합법 처방 */
export interface PrescribedAction {
  recordArea: AllowedRecordArea;
  competency: LegalityCompetency;
  text: string;
  rationale: string;
  evidence: EvidenceRef;
}

export interface LegalityResult {
  passed: PrescribedAction[];
  stripped: { recordArea: string; reason: string }[];
}

const isAllowed = (a: string): a is AllowedRecordArea =>
  (ALLOWED_RECORD_AREAS as readonly string[]).includes(a);

/** 띄어쓰기 변형 우회 차단: 내부 공백 전부 제거 후 부분문자열 비교(단어경계 아님). */
const stripWs = (s: string) => s.replace(/\s+/g, '');

/** 최후 안전망: LLM이 무엇을 제안하든 §6.2 ✅ 영역 + 증거 있는 것만 통과. 금지항목 산출 0건 보증. */
export function filterActions(candidates: ActionCandidate[]): LegalityResult {
  const passed: PrescribedAction[] = [];
  const stripped: { recordArea: string; reason: string }[] = [];
  for (const c of candidates) {
    const recordArea = c.recordArea.trim();
    if (!isAllowed(recordArea)) {
      stripped.push({ recordArea, reason: '대입 미반영/미기재 영역(§6.2 ❌·⛔)' });
      continue;
    }
    // text·rationale·evidence.quote 세 필드 모두 스캔(공백 정규화로 띄어쓰기 변형 우회 차단)
    const scanned = [c.text, c.rationale, c.evidence?.quote ?? ''].map(stripWs);
    const hit = FORBIDDEN_KEYWORDS.find((k) => {
      const nk = stripWs(k);
      return scanned.some((f) => f.includes(nk));
    });
    if (hit) {
      stripped.push({ recordArea, reason: `금지 키워드 포함: ${hit}` });
      continue;
    }
    if (!c.evidence || c.evidence.quote.trim().length === 0) {
      stripped.push({ recordArea, reason: '증거인용 누락' });
      continue;
    }
    passed.push({
      recordArea,
      competency: c.competency,
      text: c.text,
      rationale: c.rationale,
      evidence: c.evidence,
    });
  }
  return { passed, stripped };
}

// ── §6 전 출력 린트 ──────────────────────────────────────────────────────────
// filterActions(처방 게이트)는 보완안에만 적용된다. 진단·로드맵·면접·적합도 등
// 게이트 밖 섹션에 금지 키워드(학원·소논문·R&E·교외 수상·컨설팅)가 섞일 수 있어,
// 조립된 결과 전체를 스캔해 EPO 검토용으로 표면화한다.
//
// **비파괴(자동 제거 아님):** "학원에 의존하지 말고…"처럼 *권고/경계* 맥락은 §6 취지에
// 부합하므로, 키워드만으로 제거하면 정상 문장을 망칠 수 있다. 위치·문장을 플래그로
// 남겨 EPO/모니터링이 판단하게 한다. 처방(rubric)은 이미 filterActions가 하드 차단.

export interface GuardrailFlag {
  /** 발견 위치 경로(예: "diagnosis.criteria[0].weakness"). */
  path: string;
  /** 매칭된 §6.2 금지 키워드. */
  keyword: string;
  /** 키워드가 포함된 문장(검토용, 최대 160자). */
  snippet: string;
}

/** 금지 키워드가 포함된 문장만 추출(없으면 앞부분). */
function snippetFor(text: string, keyword: string): string {
  const nk = stripWs(keyword);
  const sentences = text.split(/(?<=[.。!?])\s+/);
  const hit = sentences.find((s) => stripWs(s).includes(nk));
  return (hit ?? text).trim().slice(0, 160);
}

/**
 * 임의 객체(조립된 AnalyzeResult 등)를 깊이 순회하며 모든 문자열 필드에서 §6.2 금지
 * 키워드를 찾아 위치·문장과 함께 플래그한다. 공백 정규화로 띄어쓰기 우회까지 잡는다.
 */
export function lintGuardrails(value: unknown, basePath = ''): GuardrailFlag[] {
  const flags: GuardrailFlag[] = [];
  const visit = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      const norm = stripWs(node);
      for (const k of FORBIDDEN_KEYWORDS) {
        if (norm.includes(stripWs(k))) {
          flags.push({ path, keyword: k, snippet: snippetFor(node, k) });
        }
      }
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => visit(v, `${path}[${i}]`));
    } else if (node && typeof node === 'object') {
      for (const key of Object.keys(node as Record<string, unknown>)) {
        visit((node as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
      }
    }
  };
  visit(value, basePath);
  return flags;
}
