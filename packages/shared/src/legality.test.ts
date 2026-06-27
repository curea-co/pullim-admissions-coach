import { describe, it, expect } from 'vitest';
import { filterActions, lintGuardrails, STUDENT_ECHO_KEYS, type ActionCandidate } from './legality';

const mk = (
  recordArea: string,
  text = '내용',
  evidence = { quote: 'q', section: 's' }
): ActionCandidate => ({
  recordArea,
  competency: 'ACADEMIC',
  text,
  rationale: 'r',
  evidence,
});

describe('filterActions', () => {
  it('✅ 허용 영역은 통과', () => {
    const { passed, stripped } = filterActions([mk('SETUK'), mk('CREATIVE_REGULAR'), mk('BEHAVIOR')]);
    expect(passed).toHaveLength(3);
    expect(stripped).toHaveLength(0);
  });
  it('❌ 미반영 영역(수상·자율동아리 등)은 제거', () => {
    const { passed, stripped } = filterActions([mk('AWARD'), mk('AUTONOMOUS_CLUB'), mk('SETUK')]);
    expect(passed.map((p) => p.recordArea)).toEqual(['SETUK']);
    expect(stripped).toHaveLength(2);
  });
  it('⛔ 금지 키워드 포함 텍스트는 제거', () => {
    const { passed, stripped } = filterActions([mk('SETUK', '소논문 작성을 추천')]);
    expect(passed).toHaveLength(0);
    expect(stripped[0].reason).toContain('금지 키워드');
  });
  it('증거 없는 후보는 제거', () => {
    const bad = { ...mk('SETUK'), evidence: null };
    expect(filterActions([bad]).passed).toHaveLength(0);
  });
  it('⛔ 금지 키워드가 rationale에만 있어도 제거', () => {
    const bad: ActionCandidate = { recordArea: 'SETUK', competency: 'ACADEMIC', text: '깨끗한 텍스트', rationale: '컨설팅 받으라는 근거', evidence: { quote: 'q', section: 's' } };
    const { passed, stripped } = filterActions([bad]);
    expect(passed).toHaveLength(0);
    expect(stripped[0].reason).toContain('금지 키워드');
  });
  it('⛔ 금지 키워드가 evidence.quote에만 있어도 제거', () => {
    const bad: ActionCandidate = { recordArea: 'SETUK', competency: 'ACADEMIC', text: '깨끗한 텍스트', rationale: '깨끗한 근거', evidence: { quote: '소논문 작성 실적', section: 's' } };
    const { passed, stripped } = filterActions([bad]);
    expect(passed).toHaveLength(0);
    expect(stripped[0].reason).toContain('금지 키워드');
  });
  it('⛔ 띄어쓰기 변형(소 논문 / R & E / 교외 수상)도 제거', () => {
    const variants = ['소 논문 작성', 'R & E 프로젝트', '교외 수상 추천'];
    for (const v of variants) {
      const { passed, stripped } = filterActions([mk('SETUK', v)]);
      expect(passed).toHaveLength(0);
      expect(stripped[0].reason).toContain('금지 키워드');
    }
  });
  it('공백뿐인 증거인용은 throw하지 않고 제거', () => {
    const bad: ActionCandidate = { recordArea: 'SETUK', competency: 'ACADEMIC', text: '내용', rationale: 'r', evidence: { quote: '   ', section: 's' } };
    const { passed, stripped } = filterActions([bad]);
    expect(passed).toHaveLength(0);
    expect(stripped[0].reason).toContain('증거인용 누락');
  });
  it('recordArea 양끝 공백은 trim 후 허용 판정', () => {
    const { passed, stripped } = filterActions([mk('SETUK ')]);
    expect(passed).toHaveLength(1);
    expect(stripped).toHaveLength(0);
    expect(passed[0].recordArea).toBe('SETUK');
  });
  it('★불변식: 통과 결과에 금지 영역이 절대 없다', () => {
    const candidates = ['SETUK', 'AWARD', 'READING', 'BEHAVIOR', 'PRIVATE_EDU', 'CREATIVE_REGULAR'].map((a) => mk(a));
    const { passed } = filterActions(candidates);
    for (const p of passed) expect(['SETUK', 'CREATIVE_REGULAR', 'BEHAVIOR']).toContain(p.recordArea);
  });
});

describe('lintGuardrails (전 출력 §6 린트)', () => {
  it('게이트 밖 섹션의 금지 키워드를 위치·문장과 함께 플래그', () => {
    const result = {
      diagnosis: { criteria: [{ weakness: '심화가 필요하다. 학원 도움보다 학교 활동이 낫다.' }] },
      roadmap: { note: '깨끗한 문장.' },
    };
    const flags = lintGuardrails(result);
    expect(flags).toHaveLength(1);
    expect(flags[0].keyword).toBe('학원');
    expect(flags[0].path).toBe('diagnosis.criteria[0].weakness');
    expect(flags[0].snippet).toContain('학원');
  });

  it('띄어쓰기 우회도 잡는다(교 외 수상)', () => {
    const flags = lintGuardrails({ fit: { caveat: '교 외 수상 실적은 반영되지 않는다.' } });
    expect(flags.map((f) => f.keyword)).toContain('교외 수상');
  });

  it('금지 키워드 없으면 빈 배열', () => {
    const flags = lintGuardrails({ a: '학교 세특 중심으로 탐구를 이어가라.', b: ['정상', '내용'] });
    expect(flags).toEqual([]);
  });

  it('중첩 배열/객체 전체를 순회', () => {
    const flags = lintGuardrails({
      interview: { questions: [{ answerDirection: '소논문 경험을 강조하라.' }] },
    });
    expect(flags).toHaveLength(1);
    expect(flags[0].path).toBe('interview.questions[0].answerDirection');
    expect(flags[0].keyword).toBe('소논문');
  });

  it('학생 인용 필드(quote/newEvidence)는 제외 — AI 생성물만 본다', () => {
    const result = {
      // AI 생성 관찰: 플래그 대상
      diagnosis: { criteria: [{ weakness: '학원 의존을 줄이고 학교 활동으로.' }] },
      // 학생 본인 생기부 인용: 제외 대상(학생이 '학원'을 썼어도 위반 아님)
      interview: { questions: [{ basis: { quote: '방과후 학원에서 코딩을 배움', section: '창체' } }] },
      rubric: { items: [{ evidence: { quote: '학원 영어 토론', section: '세특' } }] },
      twin: { newEvidence: ['교외 수상 경력'], outcomes: [{ matchedQuote: '컨설팅 받은 소논문' }] },
    };
    const flags = lintGuardrails(result, { skipKeys: STUDENT_ECHO_KEYS });
    // AI 생성 weakness의 '학원' 1건만 잡혀야 한다(인용/증거는 전부 제외).
    expect(flags).toHaveLength(1);
    expect(flags[0].path).toBe('diagnosis.criteria[0].weakness');
    expect(flags[0].keyword).toBe('학원');
  });

  it('skipKeys 없으면 인용 필드도 스캔(기본 동작 유지)', () => {
    const flags = lintGuardrails({ basis: { quote: '학원 다님' } });
    expect(flags).toHaveLength(1);
  });
});
