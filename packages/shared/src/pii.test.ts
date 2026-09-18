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
  it('대학교(목표/참조 대학)는 식별정보로 검출하지 않음', () => {
    expect(detectPii('서울대학교 의예과를 목표로 한다')).toHaveLength(0);
    expect(detectPii('고려대학교 진학을 희망한다')).toHaveLength(0);
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

// ── #17 후속: 실제 생기부 1건 스캔에서 드러난 누출 2 · 오탐 2 회귀 (doc 016 §3.2) ──
describe('detectPii — 누출 회귀', () => {
  it('부분 마스킹된 주민번호도 검출(앞 6자리=생년월일 노출 차단)', () => {
    expect(cats('주민등록번호： 070315-3******')).toContain('rrn');
    expect(hasBlockingPii('070315-3******')).toBe(true);
  });
  it('주민번호 전체 표기는 계속 검출', () => {
    expect(cats('980101-1234567')).toContain('rrn');
  });
  it('표 레이아웃의 담임 성명 열 — 헤더 아래 행의 이름을 검출', () => {
    const t = ['학년\t반\t번호\t담임성명', '1\t3\t12\t김민수', '2\t5\t8\t이지현', '3\t2\t15\t박정우', ''].join('\n');
    const teachers = detectPii(t).filter((m) => m.category === 'teacher').map((m) => m.value);
    expect(teachers).toEqual(['김민수', '이지현', '박정우']);
  });
  it('표 본문은 빈 줄에서 끝난다 — 이후 단락의 이름 후보는 집지 않음', () => {
    const t = ['담임성명', '김민수', '', '박정우 관련 서술은 표 밖이다'].join('\n');
    const teachers = detectPii(t).filter((m) => m.category === 'teacher').map((m) => m.value);
    expect(teachers).toEqual(['김민수']);
  });
  it('이름이 라벨 앞에 오는 표기도 검출', () => {
    expect(cats('김영수 담임교사 확인')).toContain('teacher');
  });
});

describe('detectPii — 오탐 회귀(세특 원문 손상 방지)', () => {
  it.each(['기능이 서툰 학생이 많았다', '또래 멘토링에 참여 학생의 반응', '이해가 부족한 학생을 도왔다', '다른 학생과 협력함'])(
    '관형어·일반명사 + 학생은 이름이 아니다: %s',
    (t) => expect(detectPii(t).filter((m) => m.category === 'name')).toHaveLength(0),
  );
  it('합성 라벨의 뒤 라벨어를 이름으로 잡지 않음(담임성명 → "성명")', () => {
    expect(detectPii('담임성명').filter((m) => m.category === 'teacher')).toHaveLength(0);
  });
  it('수상·활동 연월일은 생년월일로 치환하지 않음', () => {
    const t = '2024.05.30 교내 과학탐구대회 최우수상, 2023년 6월 14일 봉사 시작';
    expect(detectPii(t).filter((m) => m.category === 'birth_date')).toHaveLength(0);
    expect(redactPii(t, detectPii(t))).toBe(t);
  });
  it('라벨이 붙은 생년월일은 계속 검출', () => {
    expect(cats('생년월일： 2008.03.15')).toContain('birth_date');
    expect(cats('출생 2008년 3월 15일')).toContain('birth_date');
  });
});
