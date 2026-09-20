// 셸 검색(⌘K 팔레트)의 인덱스 + 퍼지 매칭.
//
// 1차 범위 = 좌측 레일 4항목 + 결과 화면 탭 3개. 결과 **본문**(예상 질문 문장·진단 항목)
// 인덱싱은 2차로 미룬다 — 본문은 서버 진단 결과라 클라이언트에 항상 존재하지 않는다.
//
// ⚠️ 인덱스 동기화 주의
// 레일 항목의 정본은 `components/app-shell.tsx` 의 `NAV` 상수, 탭의 정본은
// `app/result/page.tsx` 의 `tabs` 상수다. 이 파일은 두 곳을 **참조만 하고 독립적으로 정의**한다
// (app-shell 은 다른 트랙 소유라 import 결합을 만들지 않는다). 레일/탭이 바뀌면 이 인덱스도
// 같이 고쳐야 한다 — `lib/shell-search.test.ts` 가 개수·라벨·href 를 고정해 어긋남을 잡는다.

import type { Route } from 'next';

export type ShellSearchItem = {
  /** React key · aria option id 용 안정 식별자. */
  id: string;
  /** 화면에 보이는 이름 — 레일/탭의 표시 명칭과 정확히 같아야 한다(§6 표기 고정). */
  label: string;
  /**
   * next/navigation router.push 로 넘길 경로. typedRoutes 가 켜져 있어 `Route` 로 두면
   * 오타난 경로가 컴파일 단계에서 잡힌다(런타임 404 로 새지 않는다).
   */
  href: Route;
  /** 결과 목록 우측에 표시하는 출처 구분. */
  group: '메뉴' | '진단 결과';
  /** 라벨 아래 보조 설명(선택). */
  description?: string;
  /**
   * 라벨에 없는 검색어 보완. 퍼지 매칭이 음절 단위 subsequence 라 초성·동의어를 못 잡으므로
   * 학생이 실제로 칠 법한 말("리포트", "업로드", 영문 slug)을 여기에 적어 실용성을 올린다.
   */
  keywords?: string[];
};

/**
 * 부분 일치 퍼지 점수 — 연속 매칭 3점, 떨어진 매칭 1점. 매칭 실패 -1, 빈 질의 0.
 * (pullim-Q `components/shell/command-search.tsx` 의 동명 함수 이식.)
 *
 * 한글에서 **실제로 되는 범위** — 완성형(NFC) 음절 1개 = 코드 유닛 1개라 "음절 단위
 * subsequence" 로 동작한다:
 *   - "진단" → "진단 결과" ○
 *   - "생기부" → "생기부 진단 가이드" ○
 *   - "면접팩" → "학생부 종합 전형 면접 준비 팩" ○ (음절이 떨어져 있어도 순서만 맞으면 매칭)
 * **되지 않는 것**(되는 척하지 않는다):
 *   - 초성 검색 "ㅈㄷ" → "진단" ✕ — 호환 자모(U+3134…)와 완성형 음절은 다른 코드포인트다.
 *   - 자모 분해·오타 보정 "지단" ✕
 *   - 로마자 ↔ 한글 교차 "jindan" ✕
 * 이 한계는 `keywords` 로 보완한다.
 *
 * NFC 정규화: macOS 에서 복사한 문자열은 NFD(자모 분리)일 수 있어 양쪽을 NFC 로 맞춘다.
 * 정규화가 없으면 눈으로 같은 "진단"이 매칭에 실패한다.
 */
export function fuzzyScore(query: string, target: string): number {
  if (!query) return 0;
  const q = query.normalize('NFC').toLowerCase();
  const t = target.normalize('NFC').toLowerCase();
  let qi = 0;
  let score = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += lastMatch === ti - 1 ? 3 : 1;
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

/** 라벨 매칭에 얹는 가산점 — 키워드/경로 매칭보다 항상 위로 올린다. */
const LABEL_BONUS = 100;

/**
 * 항목 1건의 점수. 필드를 이어붙여 한 번에 점수 내면 "라벨 끝 글자 + 키워드 첫 글자" 같은
 * 의미 없는 교차 매칭이 걸리므로, 필드마다 따로 점수를 내고 최댓값을 쓴다.
 */
export function scoreItem(query: string, item: ShellSearchItem): number {
  if (!query) return 0;
  const label = fuzzyScore(query, item.label);
  if (label >= 0) return label + LABEL_BONUS;
  let best = -1;
  for (const kw of item.keywords ?? []) {
    const s = fuzzyScore(query, kw);
    if (s > best) best = s;
  }
  const href = fuzzyScore(query, item.href);
  if (href > best) best = href;
  return best;
}

export const SHELL_SEARCH_INDEX: ShellSearchItem[] = [
  // ── 좌측 레일 (app-shell.tsx NAV 와 1:1) ────────────────────────────────
  {
    id: 'nav-home',
    label: '홈',
    href: '/',
    group: '메뉴',
    description: '입시코치 시작 화면',
    keywords: ['home', '메인', '처음', '시작', '랜딩'],
  },
  {
    id: 'nav-submit',
    label: '생기부 제출',
    href: '/submit',
    group: '메뉴',
    description: '생활기록부 입력 · 동의',
    keywords: ['submit', '생활기록부', '입력', '업로드', '제출', '동의', '폼'],
  },
  {
    id: 'nav-result',
    label: '진단 결과',
    href: '/result',
    group: '메뉴',
    description: '면접 · 진단 · 보완 3종',
    keywords: ['result', '결과', '리포트', '분석', '진단'],
  },
  {
    id: 'nav-parent',
    label: '학부모 리포트',
    href: '/parent',
    group: '메뉴',
    description: '자녀 진행 요약',
    keywords: ['parent', '부모', '보호자', '리포트', '요약'],
  },
  // ── 결과 화면 탭 (app/result/page.tsx tabs 와 1:1) ──────────────────────
  // href 의 ?tab= 은 결과 페이지의 딥링크 파라미터다. 값(interview/diagnosis/improvements)이
  // 탭 id 와 어긋나면 조용히 기본 탭으로 떨어진다 — 테스트가 이 문자열을 고정한다.
  {
    id: 'tab-interview',
    label: '학생부 종합 전형 면접 준비 팩',
    href: '/result?tab=interview',
    group: '진단 결과',
    description: '답변 방향 · 근거 생기부 항목 · 꼬리질문 대비',
    keywords: ['면접', '학종', '예상 질문', '꼬리질문', '준비 팩', 'interview'],
  },
  {
    id: 'tab-diagnosis',
    label: '생기부 진단 가이드',
    href: '/result?tab=diagnosis',
    group: '진단 결과',
    description: '역량별 강점 · 보완 진단',
    keywords: ['진단', '생기부', '강점', '보완', '역량', 'diagnosis'],
  },
  {
    id: 'tab-improvements',
    label: '부족 활동 보완안',
    href: '/result?tab=improvements',
    group: '진단 결과',
    description: '앞으로 할 활동 · 스스로 정리할 방향',
    keywords: ['보완', '부족', '활동', '제안', '다음 활동', 'improvements'],
  },
];

/**
 * 질의로 인덱스를 거른다. 빈 질의(공백만 포함)면 인덱스 전체를 선언 순서 그대로 돌려준다 —
 * 팔레트를 열자마자 갈 수 있는 화면을 다 보여주기 위해서다.
 * 동점이면 선언 순서를 유지한다(레일 → 결과 탭 순).
 */
export function searchShell(
  query: string,
  index: ShellSearchItem[] = SHELL_SEARCH_INDEX,
): ShellSearchItem[] {
  const q = query.trim();
  if (!q) return [...index];
  return index
    .map((item, order) => ({ item, order, score: scoreItem(q, item) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((r) => r.item);
}
