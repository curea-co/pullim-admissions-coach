import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAnswerCore,
  setAnswerCore,
  listDiagnosesCore,
  saveDiagnosisCore,
  getDiagnosisCore,
} from './local-core';
import { setUserScope, currentScope } from './scope';

beforeEach(() => {
  localStorage.clear();
  setUserScope(null); // mock 세션도 없으므로 scope='anon'
});

describe('local-core (사용자 스코프)', () => {
  it('자기답변 라운드트립', () => {
    expect(getAnswerCore('q1')).toBe('');
    setAnswerCore('q1', '내 답변');
    expect(getAnswerCore('q1')).toBe('내 답변');
  });

  it('saveDiagnosis → 최신순 + getDiagnosis + 중복 방지', () => {
    const a = saveDiagnosisCore({ track: '공학계열', summary: 'A' });
    const b = saveDiagnosisCore({ track: '공학계열', summary: 'B' });
    const list = listDiagnosesCore();
    expect(list[0].id).toBe(b.id); // 최신 먼저
    expect(getDiagnosisCore(a.id)?.summary).toBe('A');
    const dup = saveDiagnosisCore({ track: '공학계열', summary: 'A' });
    expect(dup.id).toBe(a.id);
    expect(listDiagnosesCore().length).toBe(2);
  });

  it('스코프가 다르면 데이터가 격리된다(교차사용자 노출 차단)', () => {
    setUserScope('user_1');
    setAnswerCore('q1', 'user1 답');
    saveDiagnosisCore({ track: 'x', summary: 'user1 진단' });

    setUserScope('user_2');
    expect(getAnswerCore('q1')).toBe(''); // user_2는 user_1 답을 못 봄
    expect(listDiagnosesCore()).toHaveLength(0);

    setUserScope('user_1');
    expect(getAnswerCore('q1')).toBe('user1 답'); // 다시 user_1은 자기 데이터
    expect(listDiagnosesCore()).toHaveLength(1);
  });

  it('명시적 null 스코프는 세션 폴백 없이 익명 강제(로그아웃 후 스테일 방지)', () => {
    // mock 세션이 남아 있어도 setUserScope(null)이면 그 세션 스코프를 읽지 않아야 한다.
    localStorage.setItem('puds-auth-session', 'sess_stale');
    setUserScope('sess_stale');
    setAnswerCore('q', '세션 사용자 데이터');

    setUserScope(null); // 명시적 익명
    expect(currentScope()).not.toBe('sess_stale');
    expect(getAnswerCore('q')).toBe(''); // 세션 사용자 데이터를 보지 않음
  });
});
