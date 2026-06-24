import { describe, it, expect, beforeEach } from 'vitest';
import * as store from './result-store';

beforeEach(() => localStorage.clear());

describe('result-store', () => {
  it('자기답변 라운드트립', () => {
    expect(store.getAnswer('q1')).toBe('');
    store.setAnswer('q1', '내 답변');
    expect(store.getAnswer('q1')).toBe('내 답변');
  });
  it('saveDiagnosis → listDiagnoses(최신순) + getDiagnosis', () => {
    const a = store.saveDiagnosis({ track: '공학계열', summary: 'A' });
    const b = store.saveDiagnosis({ track: '공학계열', summary: 'B' });
    const list = store.listDiagnoses();
    expect(list[0].id).toBe(b.id);       // 최신 먼저
    expect(list.map((d) => d.summary)).toContain('A');
    expect(store.getDiagnosis(a.id)?.summary).toBe('A');
    expect(store.getDiagnosis('nope')).toBeNull();
  });
  it('id·createdAt 자동 생성', () => {
    const d = store.saveDiagnosis({ track: 'x', summary: 'y' });
    expect(d.id).toMatch(/^dx_/);
    expect(Number.isNaN(Date.parse(d.createdAt))).toBe(false);
  });
  it('동일 track+summary 중복 저장 방지', () => {
    const first = store.saveDiagnosis({ track: '의학계열', summary: '중복테스트' });
    const second = store.saveDiagnosis({ track: '의학계열', summary: '중복테스트' });
    expect(store.listDiagnoses().length).toBe(1);
    expect(first.id).toBe(second.id);
  });
});
