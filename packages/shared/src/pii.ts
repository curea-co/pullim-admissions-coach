// Pullim Admissions Coach — 생기부 PII 검출/치환 (#17)
// 순수 함수. 클라(submit UI)와 Phase C 서버(NestJS pipe)가 동일하게 재사용.
// 티어: block(고정밀, 하드 차단) / warn(문맥 앵커, 경고). 이름·교사는 라벨 인접만.

export type PiiCategory =
  | 'phone' | 'rrn' | 'email' | 'school'
  | 'name' | 'teacher' | 'birth_date' | 'address';
export type PiiTier = 'block' | 'warn';

export interface PiiMatch {
  category: PiiCategory;
  tier: PiiTier;
  index: number;   // 민감 토큰 시작(라벨 제외)
  length: number;
  value: string;
  placeholder: string;
  maskedField: string; // maskedFieldEnum 값
}

const PLACEHOLDER: Record<PiiCategory, string> = {
  phone: '[전화]', rrn: '[주민번호]', email: '[이메일]', school: '[학교]',
  name: '[이름]', teacher: '[교사]', birth_date: '[생년월일]', address: '[주소]',
};
const MASKED_FIELD: Record<PiiCategory, string> = {
  phone: 'phone', rrn: 'resident_registration_no', email: 'email', school: 'school_name',
  name: 'student_name', teacher: 'teacher_name', birth_date: 'birth_date', address: 'address',
};
const TIER: Record<PiiCategory, PiiTier> = {
  phone: 'block', rrn: 'block', email: 'block', school: 'block',
  name: 'warn', teacher: 'warn', birth_date: 'warn', address: 'warn',
};

// group: 민감 토큰이 들어있는 캡처그룹 번호(0 = 전체 매치). 'd'(hasIndices) 플래그로 위치 추출.
interface Rule { category: PiiCategory; re: RegExp; group: number }
const RULES: Rule[] = [
  { category: 'rrn',     re: /\d{6}-?[1-4]\d{6}/gd, group: 0 },
  { category: 'phone',   re: /01[016789]-?\d{3,4}-?\d{4}/gd, group: 0 },
  { category: 'phone',   re: /0\d{1,2}-\d{3,4}-\d{4}/gd, group: 0 },
  { category: 'email',   re: /[\w.+-]+@[\w-]+\.[\w.-]+/gd, group: 0 },
  { category: 'school',  re: /[가-힣]{2,}(?:초등학교|중학교|고등학교)/gd, group: 0 }, // 대학교는 제외 — 고등학생 생기부에서 대학교는 목표/참조이지 본인 식별정보가 아님(#17 최종리뷰).
  { category: 'name',    re: /(?:이름|성명)\s*[:：]?\s*([가-힣]{2,4})/gd, group: 1 },
  { category: 'name',    re: /([가-힣]{2,4})\s*(?:학생|군|양)(?:은|는|이|가|을|를|의|에|도|만|과|와|께)?(?![가-힣])/gd, group: 1 },
  { category: 'teacher', re: /(?:담임|교사)\s*[:：]?\s*([가-힣]{2,4})/gd, group: 1 },
  { category: 'teacher', re: /([가-힣]{2,4})\s*선생님/gd, group: 1 },
  { category: 'birth_date', re: /\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/gd, group: 0 },
  { category: 'address', re: /[가-힣]+(?:시|도)\s?[가-힣]+(?:시|군|구)\s?[가-힣]+(?:읍|면|동|로|길)/gd, group: 0 },
];

export function detectPii(text: string): PiiMatch[] {
  const raw: PiiMatch[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const span = (m as RegExpMatchArray & { indices?: Array<[number, number] | undefined> })
        .indices?.[rule.group];
      if (!span) continue;
      const [start, end] = span;
      raw.push({
        category: rule.category,
        tier: TIER[rule.category],
        index: start,
        length: end - start,
        value: text.slice(start, end),
        placeholder: PLACEHOLDER[rule.category],
        maskedField: MASKED_FIELD[rule.category],
      });
    }
  }
  // index 오름차순, 같은 시작이면 더 긴 매치 우선. 겹치는 매치는 앞선 것만 남긴다.
  raw.sort((a, b) => a.index - b.index || b.length - a.length);
  const out: PiiMatch[] = [];
  let lastEnd = -1;
  for (const m of raw) {
    if (m.index >= lastEnd) {
      out.push(m);
      lastEnd = m.index + m.length;
    }
  }
  return out;
}

export function redactPii(text: string, matches: PiiMatch[]): string {
  // 뒤에서 앞으로 치환 → 앞쪽 오프셋이 깨지지 않음.
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  let out = text;
  for (const m of sorted) {
    out = out.slice(0, m.index) + m.placeholder + out.slice(m.index + m.length);
  }
  return out;
}

export function hasBlockingPii(text: string): boolean {
  return detectPii(text).some((m) => m.tier === 'block');
}
