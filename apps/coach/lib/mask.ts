/** 결정적 PII 마스킹. 생기부를 LLM에 보내기 전 식별정보 제거([D] §6.4). LLM 의존 없음. */
const PATTERNS: [RegExp, string][] = [
  [/\d{6}-\d{7}/g, '[주민번호]'],                       // 주민등록번호
  [/01[0-9]-?\d{3,4}-?\d{4}/g, '[전화번호]'],            // 휴대전화
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[이메일]'], // 이메일
]

export function maskPII(text: string): string {
  return PATTERNS.reduce((acc, [re, rep]) => acc.replace(re, rep), text)
}
