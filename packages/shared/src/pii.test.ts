import { describe, it, expect } from 'vitest';
import { detectPii, redactPii, hasBlockingPii } from './pii';

const cats = (t: string) => detectPii(t).map((m) => m.category).sort();

describe('detectPii — block tier (고정밀)', () => {
  it('휴대전화 검출', () => expect(cats('연락처 010-1234-5678')).toContain('phone'));
  it('주민등록번호 검출', () => expect(cats('980101-1234567')).toContain('rrn'));
  it('이메일 검출', () => expect(cats('메일 hong@example.com 으로')).toContain('email'));
  it('학교명 검출', () => expect(cats('서울고등학교 재학')).toContain('school'));
  it('block tier로 분류', () => {
    expect(detectPii('010-1234-5678').every((m) => m.tier === 'block')).toBe(true);
    expect(hasBlockingPii('서울고등학교')).toBe(true);
  });
});

describe('detectPii — warn tier (문맥 앵커)', () => {
  it('이름: 라벨 인접', () => expect(cats('이름: 홍길동')).toContain('name'));
  it('○○ 학생', () => expect(cats('김철수 학생은 성실하다')).toContain('name'));
  it('담임 라벨', () => expect(cats('담임 박영희')).toContain('teacher'));
  it('○○ 선생님', () => expect(cats('이순신 선생님께')).toContain('teacher'));
  it('생년월일', () => expect(cats('생년월일 2008.03.15')).toContain('birth_date'));
  it('주소', () => expect(cats('서울시 강남구 역삼동')).toContain('address'));
  it('warn은 hasBlockingPii=false', () => expect(hasBlockingPii('이름: 홍길동')).toBe(false));
  it('○○ 군 (문장 끝)도 검출', () => {
    expect(detectPii('상담 대상은 이몽룡 군').map((m) => m.category)).toContain('name');
  });
});

describe('detectPii — 음성(false positive 방지)', () => {
  it('라벨 없는 일반 한글어는 미검출', () => {
    expect(detectPii('자료구조와 동아리 활동을 2년 연속 했다')).toHaveLength(0);
  });
  it('라벨 없는 이름 후보 단독은 미검출', () => {
    expect(detectPii('프로젝트를 주도했다')).toHaveLength(0);
  });
  it('이미 치환된 플레이스홀더는 재검출 안 함', () => {
    expect(detectPii('[이름]은 [학교]에서 [전화]로')).toHaveLength(0);
  });
  it('학생회 등 compound noun은 이름으로 오검출하지 않음', () => {
    expect(detectPii('전교 학생회 회장으로 활동')).toHaveLength(0);
    expect(detectPii('동아리 양성 프로그램 참여')).toHaveLength(0);
  });
});

describe('redactPii', () => {
  it('라벨 보존하고 토큰만 치환', () => {
    const t = '이름: 홍길동';
    expect(redactPii(t, detectPii(t))).toBe('이름: [이름]');
  });
  it('다중 매치 치환', () => {
    const t = '서울고등학교 010-1234-5678';
    const r = redactPii(t, detectPii(t));
    expect(r).toContain('[학교]');
    expect(r).toContain('[전화]');
    expect(r).not.toMatch(/\d{4}/);
  });
  it('idempotent — 재실행 시 변화 없음', () => {
    const t = '연락처 010-1234-5678';
    const once = redactPii(t, detectPii(t));
    expect(redactPii(once, detectPii(once))).toBe(once);
  });
});
