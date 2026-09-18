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

// ── 이름 판별 보조(#17 후속) ────────────────────────────────────────────────
// 라벨 없이 `○○ 학생` 형태만 보는 규칙은 관형어("서툰 학생")·일반명사("참여 학생")를
// 이름으로 오검출해 세특 원문을 손상시킨다. 실측(테스트 생기부 1건)에서 오탐 4/5.
// 두 신호를 함께 요구해 거른다: ① 첫 음절이 실제 한국 성씨 ② 토큰이 일반어가 아님.

/** 상위 빈도 한국 성씨(단음절). 복성(남궁·선우…)도 첫 음절이 이 집합에 든다. */
const SURNAMES = new Set(
  ('김이박최정강조윤장임오한신서권황안송전홍유고문양손배백허남심노하곽성차주우구나지엄채원천방' +
   '공현함변염여추도소석선설마길연위표명기반라왕금옥육인맹제모탁국어은편용예봉사진')
    .split(''),
);

/**
 * 성씨로 시작하지만 이름이 아닌 일반어 — 생기부에 반복 등장하는 것만 모았다.
 * 관형형("서툰")과 명사구("참여")가 대부분이며, 성씨가 아닌 첫 음절(다른·많은…)은
 * SURNAMES 검사에서 이미 걸러지므로 여기 담지 않는다.
 */
const NON_NAME_TOKENS = new Set([
  // 관형형
  '서툰', '우수한', '성실한', '강한', '약한', '정한', '정확한', '진지한', '차분한', '조용한',
  '신중한', '선한', '남은', '고른', '고운', '나은', '주된', '지친', '마른', '여린', '도운',
  '안된', '원하는', '신나는', '성장한', '문제된', '유사한', '상이한', '적절한', '충분한',
  // 명사·수식구
  '참여', '전학', '모든', '여러', '우리', '모범', '장애', '한국', '고교', '신입', '남녀',
  '해당', '지원', '본인', '대상', '상담', '교우', '동료', '급우', '개별', '전체', '일반',
  '성별', '성명', '이름', '학년', '학급', '번호', '비고', '확인', '서명', '사진', '구분',
  '담임', '교사', '선생', '지도', '보호', '학부', '학교', '기타', '연락', '주소', '기록',
]);

/** 사람 이름처럼 보이는가 — 성씨 whitelist + 일반어 stopword. warn 티어 휴리스틱이다. */
function looksLikeKoreanName(token: string): boolean {
  if (token.length < 2 || token.length > 4) return false;
  if (!SURNAMES.has(token[0]!)) return false;
  return !NON_NAME_TOKENS.has(token);
}

// group: 민감 토큰이 들어있는 캡처그룹 번호(0 = 전체 매치). 'd'(hasIndices) 플래그로 위치 추출.
// validate: 캡처 토큰 추가 검증(선택). 라벨 앵커가 약한 규칙에만 붙인다.
interface Rule {
  category: PiiCategory;
  re: RegExp;
  group: number;
  validate?: (token: string) => boolean;
}
const RULES: Rule[] = [
  // 뒤 7자리를 `[\d*]{6}` 로 완화 — `070315-3******` 처럼 부분 마스킹된 값도 잡는다.
  // 앞 6자리(생년월일)가 그대로 남는 것이 §6.3 위반이므로 block 티어를 유지한다.
  { category: 'rrn',     re: /\d{6}-?[1-4](?:[\d*]{6}|\*{1,5})/gd, group: 0 },
  { category: 'phone',   re: /01[016789]-?\d{3,4}-?\d{4}/gd, group: 0 },
  { category: 'phone',   re: /0\d{1,2}-\d{3,4}-\d{4}/gd, group: 0 },
  { category: 'email',   re: /[\w.+-]+@[\w-]+\.[\w.-]+/gd, group: 0 },
  { category: 'school',  re: /[가-힣]{2,}(?:초등학교|중학교|고등학교)/gd, group: 0 }, // 대학교는 제외 — 고등학생 생기부에서 대학교는 목표/참조이지 본인 식별정보가 아님(#17 최종리뷰).
  // `담임성명`·`담임 성명`은 교사 라벨이다 — 학생 이름으로 분류하면 maskedField 가
  // student_name 으로 잘못 기록된다(마스킹 자체는 되지만 감사 기록이 틀어진다).
  { category: 'name',    re: /(?<!담임\s*)(?:이름|성명)\s*[:：]?\s*([가-힣]{2,4})/gd, group: 1 },
  { category: 'name',    re: /([가-힣]{2,4})\s*(?:학생|군|양)(?:은|는|이|가|을|를|의|에|도|만|과|와|께)?(?![가-힣])/gd, group: 1, validate: looksLikeKoreanName },
  // `담임성명` 같은 합성 라벨에서 뒤 라벨어("성명")를 이름으로 잡던 오탐을 validate 로 차단.
  // 이름이 라벨 앞에 오는 표기(`김영수 담임교사`)도 별도 규칙으로 받는다.
  { category: 'teacher', re: /(?:담임교사|담임\s*성명|담임|교사)\s*[:：]?\s*([가-힣]{2,4})/gd, group: 1, validate: looksLikeKoreanName },
  { category: 'teacher', re: /([가-힣]{2,4})\s*(?:담임교사|담임)(?![가-힣])/gd, group: 1, validate: looksLikeKoreanName },
  { category: 'teacher', re: /([가-힣]{2,4})\s*선생님/gd, group: 1, validate: looksLikeKoreanName },
  // 라벨 인접만 — 앵커 없이 날짜 형태만 보면 수상·활동 연월일이 전부 [생년월일]로 치환돼
  // 시간 순서 분석이 불가능해진다(실측 17건 과마스킹). 파일 상단 "라벨 인접만" 원칙과도 어긋났다.
  { category: 'birth_date', re: /(?:생년월일|생일|출생일|출생)\s*[:：]?\s*(\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?)/gd, group: 1 },
  { category: 'address', re: /[가-힣]+(?:시|도)\s?[가-힣]+(?:시|군|구)\s?[가-힣]+(?:읍|면|동|로|길)/gd, group: 0 },
];

/**
 * 표 레이아웃의 담임 성명 열 — `담임성명` 헤더 아래 행에 이름만 놓이는 형태.
 * 라벨이 이름에 인접하지 않아 정규식 규칙이 전부 놓친다(실측 3명 전원 누출).
 * 헤더 줄 다음부터 빈 줄 전까지를 표 본문으로 보고, 성씨 whitelist를 통과한 토큰만 집는다.
 */
const TEACHER_TABLE_HEADER = /담임\s*(?:성명|이름)/g;
const MAX_TABLE_ROWS = 12;

function detectTeacherTableNames(text: string): PiiMatch[] {
  const out: PiiMatch[] = [];
  for (const header of text.matchAll(TEACHER_TABLE_HEADER)) {
    const headerEnd = text.indexOf('\n', header.index!);
    if (headerEnd === -1) continue;
    let cursor = headerEnd + 1;
    for (let row = 0; row < MAX_TABLE_ROWS; row++) {
      let lineEnd = text.indexOf('\n', cursor);
      if (lineEnd === -1) lineEnd = text.length;
      const line = text.slice(cursor, lineEnd);
      if (line.trim() === '') break; // 표 끝
      for (const tok of line.matchAll(/[가-힣]{2,4}/g)) {
        if (!looksLikeKoreanName(tok[0])) continue;
        out.push({
          category: 'teacher',
          tier: TIER.teacher,
          index: cursor + tok.index!,
          length: tok[0].length,
          value: tok[0],
          placeholder: PLACEHOLDER.teacher,
          maskedField: MASKED_FIELD.teacher,
        });
      }
      if (lineEnd === text.length) break;
      cursor = lineEnd + 1;
    }
  }
  return out;
}

export function detectPii(text: string): PiiMatch[] {
  const raw: PiiMatch[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const span = (m as RegExpMatchArray & { indices?: Array<[number, number] | undefined> })
        .indices?.[rule.group];
      if (!span) continue;
      const [start, end] = span;
      const value = text.slice(start, end);
      if (rule.validate && !rule.validate(value)) continue;
      raw.push({
        category: rule.category,
        tier: TIER[rule.category],
        index: start,
        length: end - start,
        value,
        placeholder: PLACEHOLDER[rule.category],
        maskedField: MASKED_FIELD[rule.category],
      });
    }
  }
  raw.push(...detectTeacherTableNames(text));
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
