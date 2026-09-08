import { describe, expect, it } from 'vitest';
import {
  fuzzyScore,
  scoreItem,
  searchShell,
  SHELL_SEARCH_INDEX,
  type ShellSearchItem,
} from './shell-search';

// 검색 인덱스는 좌측 레일(app-shell.tsx NAV)·결과 탭(app/result/page.tsx tabs)의 **복사본**이라
// 원본이 바뀌면 조용히 어긋난다. 개수·라벨·href 를 여기서 고정해 그 어긋남을 실패로 만든다.

describe('fuzzyScore', () => {
  it('빈 질의는 0', () => {
    expect(fuzzyScore('', '진단 결과')).toBe(0);
  });

  it('매칭 실패는 -1', () => {
    expect(fuzzyScore('zzz', '진단 결과')).toBe(-1);
    // 부분만 맞아도 전부 못 맞추면 실패다(전체 subsequence 요구).
    expect(fuzzyScore('진단결과학', '진단 결과')).toBe(-1);
  });

  it('연속 매칭에 가중치를 준다', () => {
    // 붙어 있으면 3점, 떨어져 있으면 1점. 문자열 맨 앞 매칭도 "연속"으로 쳐서 3점 —
    // 접두사 매칭이 중간 매칭보다 위로 올라온다.
    expect(fuzzyScore('ab', 'ab')).toBe(6); // 3 + 3
    expect(fuzzyScore('ab', 'axb')).toBe(4); // 3 + 1
    expect(fuzzyScore('ab', 'xaxb')).toBe(2); // 1 + 1
    expect(fuzzyScore('ab', 'ab')).toBeGreaterThan(fuzzyScore('ab', 'axb'));
    expect(fuzzyScore('ab', 'axb')).toBeGreaterThan(fuzzyScore('ab', 'xaxb'));
  });

  it('대소문자를 무시한다', () => {
    expect(fuzzyScore('RESULT', '/result')).toBeGreaterThan(0);
  });

  it('한글은 완성형 음절 단위 subsequence 로 매칭된다', () => {
    expect(fuzzyScore('진단', '진단 결과')).toBeGreaterThan(0);
    expect(fuzzyScore('생기부', '생기부 진단 가이드')).toBeGreaterThan(0);
    // 음절이 떨어져 있어도 순서만 맞으면 매칭.
    expect(fuzzyScore('면접팩', '학생부 종합 전형 면접 준비 팩')).toBeGreaterThan(0);
    // 순서가 뒤집히면 실패.
    expect(fuzzyScore('단진', '진단 결과')).toBe(-1);
  });

  it('NFD(자모 분리) 문자열도 NFC 로 정규화해 매칭한다', () => {
    // macOS 에서 복사한 텍스트는 NFD 일 수 있다 — 정규화가 없으면 눈에 같은 글자가 안 맞는다.
    expect(fuzzyScore('진단'.normalize('NFD'), '진단 결과')).toBeGreaterThan(0);
    expect(fuzzyScore('진단', '진단 결과'.normalize('NFD'))).toBeGreaterThan(0);
  });

  it('초성 검색은 지원하지 않는다(문서화된 한계)', () => {
    // 호환 자모 ㅈ/ㄷ 은 완성형 음절과 다른 코드포인트라 subsequence 로 잡히지 않는다.
    expect(fuzzyScore('ㅈㄷ', '진단 결과')).toBe(-1);
  });
});

describe('scoreItem', () => {
  const item: ShellSearchItem = {
    id: 'x',
    label: '진단 결과',
    href: '/result',
    group: '메뉴',
    keywords: ['리포트'],
  };

  it('라벨 매칭이 키워드/경로 매칭보다 항상 높다', () => {
    expect(scoreItem('진단', item)).toBeGreaterThan(scoreItem('리포트', item));
    expect(scoreItem('진단', item)).toBeGreaterThan(scoreItem('result', item));
  });

  it('키워드로도 매칭된다', () => {
    expect(scoreItem('리포트', item)).toBeGreaterThanOrEqual(0);
  });

  it('어디에도 없으면 -1', () => {
    expect(scoreItem('zzz', item)).toBe(-1);
  });

  it('필드를 가로지르는 매칭은 잡지 않는다', () => {
    // 라벨 끝 "과" + 키워드 "리" 처럼 서로 다른 필드에 걸친 subsequence 는 매칭이 아니다.
    expect(scoreItem('과리', item)).toBe(-1);
  });
});

describe('SHELL_SEARCH_INDEX', () => {
  it('레일 4항목 + 결과 탭 3개, 총 7건', () => {
    expect(SHELL_SEARCH_INDEX).toHaveLength(7);
  });

  it('레일 4항목이 app-shell NAV 와 같은 라벨·경로다', () => {
    const nav = SHELL_SEARCH_INDEX.filter((i) => i.group === '메뉴');
    expect(nav.map((i) => [i.label, i.href])).toEqual([
      ['홈', '/'],
      ['생기부 제출', '/submit'],
      ['진단 결과', '/result'],
      ['학부모 리포트', '/parent'],
    ]);
  });

  it('결과 탭 3개가 result 페이지 tabs 와 같은 라벨이고 ?tab= 딥링크를 가진다', () => {
    const tabs = SHELL_SEARCH_INDEX.filter((i) => i.group === '진단 결과');
    expect(tabs.map((i) => [i.label, i.href])).toEqual([
      ['학생부 종합 전형 면접 준비 팩', '/result?tab=interview'],
      ['생기부 진단 가이드', '/result?tab=diagnosis'],
      ['부족 활동 보완안', '/result?tab=improvements'],
    ]);
  });

  it('id 가 중복되지 않는다(React key · aria option id 로 쓰인다)', () => {
    const ids = SHELL_SEARCH_INDEX.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('§6 가드레일 금칙어(정답·합격·대본)를 카피에 쓰지 않는다', () => {
    const text = SHELL_SEARCH_INDEX.map(
      (i) => `${i.label} ${i.description ?? ''} ${(i.keywords ?? []).join(' ')}`,
    ).join(' ');
    for (const banned of ['정답', '합격', '대본']) {
      expect(text).not.toContain(banned);
    }
  });
});

describe('searchShell', () => {
  it('빈 질의는 인덱스 전체를 선언 순서대로', () => {
    expect(searchShell('')).toEqual(SHELL_SEARCH_INDEX);
    expect(searchShell('   ')).toEqual(SHELL_SEARCH_INDEX);
  });

  it('반환 배열은 원본 인덱스의 복사본이다(호출자가 정렬해도 인덱스가 안 망가진다)', () => {
    expect(searchShell('')).not.toBe(SHELL_SEARCH_INDEX);
  });

  it('한글 질의 "진단" → 진단 결과 · 생기부 진단 가이드', () => {
    expect(searchShell('진단').map((i) => i.label)).toEqual([
      '진단 결과',
      '생기부 진단 가이드',
    ]);
  });

  it('한글 질의 "면접" → 면접 준비 팩', () => {
    expect(searchShell('면접').map((i) => i.href)).toContain('/result?tab=interview');
  });

  it('키워드로도 찾힌다: "리포트" → 진단 결과 · 학부모 리포트', () => {
    const hrefs = searchShell('리포트').map((i) => i.href);
    expect(hrefs).toContain('/parent');
    expect(hrefs).toContain('/result');
  });

  it('영문 slug 로도 찾힌다: "diagnosis" → 생기부 진단 가이드', () => {
    expect(searchShell('diagnosis').map((i) => i.href)).toContain('/result?tab=diagnosis');
  });

  it('매칭 0건이면 빈 배열', () => {
    expect(searchShell('zzzzzz')).toEqual([]);
  });

  it('라벨이 정확히 맞는 항목이 키워드로만 맞는 항목보다 앞에 온다', () => {
    // "학부모 리포트"는 라벨 매칭, "진단 결과"는 keywords 의 "리포트" 매칭.
    expect(searchShell('학부모 리포트')[0]?.href).toBe('/parent');
  });
});
