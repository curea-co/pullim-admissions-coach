# 부족 활동 보완안 재설계 Implementation Plan (#20)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출력③ '부족 활동 보완안'을 2024 미반영 항목(독서·자율동아리·수상·개인봉사·영재발명) 신설 추천에서 현행 반영 항목(세특 탐구·교과–진로 연계·정규 창체 깊이) 중심으로 전환하고, 미반영 항목 신설 추천을 차단하는 테스트된 가드를 도입한다.

**Architecture:** 추천-vs-인용을 구분하는 순수 함수 `flagsUnreflectedRecommendation`를 `packages/shared`에 두고(Phase D 스캐너 재사용), 같은 정규식을 prompt §4.7 NG로 문서화한다. mock·result UI는 반영-항목 카피로 전환. SSOT(prompt·golden·definition)는 EPO 검수. 본 브랜치는 `feat/19` 위에 스택(#19의 3역량/golden 전환을 전제).

**Tech Stack:** TypeScript 5.5.4, Zod(미사용 — 순수 정규식), Vitest ^2.1(이미 도입됨, #19), React 18/Next 14.

## Global Constraints

- **미반영 항목(2024~, 신설 추천 금지):** 독서활동 · 자율동아리(정규/정식 동아리는 반영) · 수상경력 · 개인 봉사활동 실적 · 영재·발명교육.
- **금지 대상 = *신설 추천*만.** 기존 기록을 *근거(evidence)로 인용*하는 것은 허용. (예: ❌"독서 1~2권 추가하라" / ✅"독서활동에서 보인 관심을 세특 탐구로 연결").
- **반영 항목(추천 가능):** 교과 세특 탐구·심화, 교과–진로 연계, 정규 창의적 체험활동(정식 동아리·자율활동·진로활동) 깊이, 자기주도 학습 정리.
- 모든 보완 제안의 주어=**학생 본인**, 시점=**앞으로** (§6.1 유지). 명칭 "**부족 활동 보완안**" 유지(§4-3 확정).
- 진단②(#19)·면접① 산출물 불변. 입력 스키마 불변.
- 런타임: node>=20.11, pnpm 9.7.0, vitest ^2.1.
- **EPO(최선혜) 검수 게이트:** Task 3·4(prompt·golden·definition)는 승인 전 머지 금지.

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `packages/shared/src/guardrails/unreflected-activities.ts` (생성) | 미반영-항목 추천 검출 순수 함수 | 1 |
| `packages/shared/src/guardrails/unreflected-activities.test.ts` (생성) | 양성/음성 단위테스트 | 1 |
| `packages/shared/src/index.ts` (수정) | barrel export | 1 |
| `apps/web/lib/mock/park-junho.ts` (수정) | improvements.suggestions·fitDelta 반영-항목 전환 | 2 |
| `apps/web/app/result/page.tsx` (수정) | ImprovementsPanel 프레이밍 카피 | 2 |
| `docs/prompt_v0.1.md` (수정) | improvements 규칙 + §4.7 NG + 체크리스트 | 3 |
| `docs/golden/case-01~05-*.md` (수정) | 출력③ 반영-항목 재작성 + NG 셋 | 4 |
| `docs/golden/README.md`·`docs/002_..._definition_v.3.md` (수정) | §4-3 카피 정합 | 4 |
| `packages/shared/src/guardrails/golden-unreflected.test.ts` (생성) | golden 출력③ 회귀 게이트 | 4 |

---

### Task 1: 미반영-항목 추천 검출 가드 (`packages/shared`)

**Files:**
- Create: `packages/shared/src/guardrails/unreflected-activities.ts`, `.../unreflected-activities.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces (Task 2·4 의존):
  - `UNREFLECTED_RECOMMENDATION_RE: RegExp`
  - `flagsUnreflectedRecommendation(text: string): boolean`
  - `findUnreflectedRecommendations(text: string): string[]`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `packages/shared/src/guardrails/unreflected-activities.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  flagsUnreflectedRecommendation,
  findUnreflectedRecommendations,
} from './unreflected-activities';

describe('flagsUnreflectedRecommendation — 양성(미반영 신설 추천)', () => {
  it('독서 추가 추천', () =>
    expect(flagsUnreflectedRecommendation('관심 분야 독서 1~2권 추가')).toBe(true));
  it('자율동아리 신설', () =>
    expect(flagsUnreflectedRecommendation('자율동아리를 만들어 활동을 늘릴 것')).toBe(true));
  it('수상 준비', () =>
    expect(flagsUnreflectedRecommendation('교내 대회 수상을 준비해보세요')).toBe(true));
  it('봉사 실적 쌓기', () =>
    expect(flagsUnreflectedRecommendation('개인 봉사활동 실적을 더 쌓아 둘 것')).toBe(true));
  it('영재교육 참가', () =>
    expect(flagsUnreflectedRecommendation('영재교육원에 참가해보면 좋겠습니다')).toBe(true));
});

describe('flagsUnreflectedRecommendation — 음성(근거 인용·반영 항목)', () => {
  it('독서를 근거로 인용(추천 아님)', () =>
    expect(
      flagsUnreflectedRecommendation('독서활동에서 보인 관심을 세특 탐구로 연결할 것')
    ).toBe(false));
  it('정규 동아리 깊이(자율동아리 아님)', () =>
    expect(
      flagsUnreflectedRecommendation('정규 동아리 활동의 깊이를 본인이 정리할 것')
    ).toBe(false));
  it('수상 경력에서 보인 관심(인용)', () =>
    expect(flagsUnreflectedRecommendation('수상 경력에서 보인 관심을 살릴 것')).toBe(false));
  it('세특 탐구 추천(반영 항목)', () =>
    expect(
      flagsUnreflectedRecommendation('정보 수업의 심화 관심을 탐구·발표로 만들 것')
    ).toBe(false));
});

describe('findUnreflectedRecommendations', () => {
  it('매치 스니펫을 반환', () => {
    const hits = findUnreflectedRecommendations('관심 분야 독서 1~2권 추가하고 봉사 실적도 쌓을 것');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });
  it('깨끗한 텍스트는 빈 배열', () => {
    expect(findUnreflectedRecommendations('세특 탐구를 본인이 정리할 것')).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: FAIL — `Cannot find module './unreflected-activities'`.

- [ ] **Step 3: 구현**

Create `packages/shared/src/guardrails/unreflected-activities.ts`:
```ts
// Pullim Admissions Coach — 2024 미반영 항목 '신설 추천' 검출 가드 (#20)
// 순수 함수. Phase D 서버 guardrail-scanner가 재사용. prompt §4.7 NG와 동일 소스.
// 금지: 미반영 항목을 '새로 하라'는 추천. 허용: 기존 기록을 근거로 인용.

// 미반영 항목 토큰. '자율동아리'만 — 정규/정식 동아리는 반영이므로 제외.
const TERM =
  '(?:독서(?:활동)?|자율\\s*동아리|수상(?:\\s*경력|\\s*실적)?|대회\\s*수상|봉사활동\\s*실적|개인\\s*봉사(?:활동)?|영재(?:\\s*교육)?(?:원)?|발명(?:\\s*교육)?)';

// 추천(신설/늘리기) 동사. '연결/정리/살리/드러내' 등 인용·정리 동사는 제외.
const VERB =
  '(?:추가|더\\s*읽|읽어|신설|새로\\s*만들|만들|참가|참여|준비|쌓|해\\s*보|시작)';

// 미반영 항목 토큰과 추천 동사가 한 줄에서 15자 이내로 근접하면(어느 순서든) 신설 추천으로 본다.
export const UNREFLECTED_RECOMMENDATION_RE = new RegExp(
  `${TERM}[^.\\n]{0,15}${VERB}|${VERB}[^.\\n]{0,15}${TERM}`,
  'g'
);

export function findUnreflectedRecommendations(text: string): string[] {
  // 'g' 정규식 재사용 시 lastIndex 오염 방지 위해 매 호출 새 인스턴스 사용.
  const re = new RegExp(UNREFLECTED_RECOMMENDATION_RE.source, 'g');
  const out: string[] = [];
  for (const m of text.matchAll(re)) out.push(m[0]);
  return out;
}

export function flagsUnreflectedRecommendation(text: string): boolean {
  return findUnreflectedRecommendations(text).length > 0;
}
```

- [ ] **Step 4: barrel export**

`packages/shared/src/index.ts` 끝에 추가:
```ts
export * from './guardrails/unreflected-activities';
```

- [ ] **Step 5: 테스트 통과 + 타입체크**

Run: `pnpm --filter @pullim/shared test && pnpm --filter @pullim/shared typecheck`
Expected: 본 태스크 테스트 전부 pass(+기존 #19 테스트 유지), typecheck 무에러.

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/guardrails/unreflected-activities.ts packages/shared/src/guardrails/unreflected-activities.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): 미반영 항목 신설 추천 검출 가드 (#20)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: mock + result UI 반영-항목 전환 (`apps/web`)

**Files:**
- Modify: `apps/web/lib/mock/park-junho.ts`, `apps/web/app/result/page.tsx`

**Interfaces:**
- Consumes: Task 1 `flagsUnreflectedRecommendation` (검증 스텝에서만).

- [ ] **Step 1: park-junho improvements 전환**

`apps/web/lib/mock/park-junho.ts`의 `improvements` 블록에서:

1) `suggestions` 배열의 **2번째 항목('관심 분야 독서 1~2권 추가')**을 반영-항목으로 교체:
```ts
      {
        title: '교과 탐구를 세특으로 연결',
        description:
          '정보·수학 수업에서의 심화 관심을 본인이 탐구·발표로 이어가 세특에 드러날 시도를 만들 것.',
      },
```
(1번 '본인 주도 프로젝트 정리'·3번 '협력 경험 보강'은 반영-항목이라 유지.)

2) `fitDelta`를 갭-메우기 톤에서 강점-드러내기 톤으로 교체:
```ts
    fitDelta:
      '공학계열 기준 — 학업역량은 강세입니다. 진로역량의 *실제 시도*를 세특·진로활동 기록으로 더 또렷이 드러내면 평가 인상이 선명해집니다. 공동체역량(성실성·협업)은 안정권.',
```
(`keywords`는 그대로 유지.)

- [ ] **Step 2: ImprovementsPanel 프레이밍 카피**

`apps/web/app/result/page.tsx`의 `ImprovementsPanel`에서 키워드/적합도 섹션 제목(현 "생기부 키워드 & 학부 적합도")을 강점-드러내기 프레이밍으로 교체:
```tsx
          생기부 키워드 & 강점을 드러낼 방향
```
보완 제안 섹션 제목(현 "보완 활동 제안 3건 — 학생 본인이 앞으로 할 활동")은 그대로 유지(주어=본인·시점=앞으로 충족).

- [ ] **Step 3: 가드 통과 확인(검증)**

새 mock의 보완 제안·fitDelta가 미반영 추천 가드를 트립하지 않는지 확인. 임시 스크립트 실행:
```bash
node --input-type=module -e "
import { flagsUnreflectedRecommendation } from './packages/shared/src/guardrails/unreflected-activities.ts';
" 2>/dev/null || echo 'TS 직접 실행 불가 — 아래 정규식 인라인 확인 사용'
node -e '
const TERM=String.raw\`(?:독서(?:활동)?|자율\s*동아리|수상(?:\s*경력|\s*실적)?|대회\s*수상|봉사활동\s*실적|개인\s*봉사(?:활동)?|영재(?:\s*교육)?(?:원)?|발명(?:\s*교육)?)\`;
const VERB=String.raw\`(?:추가|더\s*읽|읽어|신설|새로\s*만들|만들|참가|참여|준비|쌓|해\s*보|시작)\`;
const RE=new RegExp(TERM+String.raw\`[^.\n]{0,15}\`+VERB+"|"+VERB+String.raw\`[^.\n]{0,15}\`+TERM,"g");
const texts=[
 "정보·수학 수업에서의 심화 관심을 본인이 탐구·발표로 이어가 세특에 드러날 시도를 만들 것.",
 "동아리에서 만든 산출물·코드를 학생 본인이 정리하여 시도와 학습 과정을 드러낼 것.",
 "동아리·수행평가에서의 팀 작업에서 본인 역할·기여를 한두 줄로 정리.",
 "공학계열 기준 — 학업역량은 강세입니다. 진로역량의 실제 시도를 세특·진로활동 기록으로 더 또렷이 드러내면 평가 인상이 선명해집니다. 공동체역량은 안정권."
];
for(const t of texts) console.log([...t.matchAll(new RegExp(RE.source,"g"))].length, t.slice(0,20));
'
```
Expected: 모든 줄 `0` (미반영 추천 매치 없음). 0이 아니면 mock 문구를 조정.

- [ ] **Step 4: 타입체크 + 빌드**

Run: `pnpm --filter @pullim/web typecheck && pnpm --filter @pullim/web build`
Expected: 무에러, 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/lib/mock/park-junho.ts apps/web/app/result/page.tsx
git commit -m "feat(web): 보완안을 반영 항목 중심으로 전환 — 독서 추천 제거 (#20)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: prompt SSOT — improvements 규칙 + §4.7 NG (EPO 검수)

**Files:**
- Modify: `docs/prompt_v0.1.md`

**Interfaces:**
- Consumes: Task 1 `UNREFLECTED_RECOMMENDATION_RE`(동일 소스 명시).

- [ ] **Step 1: §2 improvements 규칙 추가**

`docs/prompt_v0.1.md` §2 시스템 프롬프트의 출력 JSON 스키마에서 `"improvements"` 블록 바로 아래(또는 `# 톤·언어` 인근의 규칙부)에 규칙 문단을 추가:
```
## §4-3 보완안은 현행 반영 항목 중심 (2024 개편 반영)
- 보완 제안(`improvements.suggestions`)은 현행 학종 *반영* 항목 중심으로 한다: 교과 세특으로 드러낼 탐구·심화, 교과–진로 연계, 정규 창의적 체험활동(정식 동아리·자율활동·진로활동) 깊이, 자기주도 학습 정리.
- 절대 금지: **2024 미반영 항목의 *신설* 추천** — 독서활동·자율동아리·수상경력·개인 봉사활동 실적·영재/발명교육을 "추가/신설/만들/참가/준비/쌓으라"고 권하지 않는다.
- 단, *이미 있는* 기록을 **근거로 인용**하는 것은 허용한다(예: "독서활동에서 보인 관심을 세특 탐구로 연결").
- 모든 제안의 주어는 *학생 본인*, 시점은 *앞으로*다.
```

- [ ] **Step 2: §4.7 NG 정규식 추가**

§4에 하위 절 추가(코드 펜스의 백틱은 ``` 로):
```
### 4.7 §4-3(보완안) NG 정규식 — 미반영 항목 신설 추천 (#20)

미반영 항목 토큰과 추천 동사가 한 줄에서 15자 이내로 근접하면 매치(어느 순서든). `packages/shared/src/guardrails/unreflected-activities.ts`의 `UNREFLECTED_RECOMMENDATION_RE`와 동일 소스. 매치 시 회귀 실패.

TERM = (?:독서(?:활동)?|자율\s*동아리|수상(?:\s*경력|\s*실적)?|대회\s*수상|봉사활동\s*실적|개인\s*봉사(?:활동)?|영재(?:\s*교육)?(?:원)?|발명(?:\s*교육)?)
VERB = (?:추가|더\s*읽|읽어|신설|새로\s*만들|만들|참가|참여|준비|쌓|해\s*보|시작)
NG   = TERM[^.\n]{0,15}VERB | VERB[^.\n]{0,15}TERM
```

- [ ] **Step 3: 자기검토 체크리스트 1줄 추가**

§2 끝 자기검토 체크리스트에 항목 추가(번호는 현재 최대+1):
```
9. `improvements.suggestions`에 미반영 항목(독서·자율동아리·수상·개인봉사·영재발명) 신설 추천 0건(근거 인용은 허용).
```
(체크리스트 총 개수 표기가 있으면 +1로 동기화.)

- [ ] **Step 4: 게이트 + 커밋**

Run: `just check`
Expected: lint·typecheck·test 통과(문서 변경, 코드 무영향).
**EPO 검수 게이트:** 승인 전 머지 금지.
```bash
git add docs/prompt_v0.1.md
git commit -m "docs(prompt): 보완안 반영-항목 규칙 + §4.7 미반영 추천 NG (#20)

EPO(최선혜) 검수 필요: 프롬프트 SSOT 변경.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: golden + definition + 회귀 게이트 (EPO 검수)

**Files:**
- Modify: `docs/golden/case-01~05-*.md`, `docs/golden/README.md`, `docs/002_Admissions_Coach_definition_v.3.md`
- Create: `packages/shared/src/guardrails/golden-unreflected.test.ts`

**Interfaces:**
- Consumes: Task 1 `flagsUnreflectedRecommendation`.

- [ ] **Step 1: case-01 출력③ 교체**

`docs/golden/case-01-park-junho.md`의 "## 기대 출력 ③ 부족 활동 보완안" 섹션에서 **'2. 관심 분야 독서 1~2권 추가 …' 제안을 반영-항목으로 교체**:
```
  2. **교과 탐구를 세특으로 연결** — 정보·수학 수업의 심화 관심을 본인이 탐구·발표로 이어가 세특에 드러날 시도를 만들 것.
```
'적합도 차이' 줄의 톤이 갭-메우기면 강점-드러내기로 보정(예: "…더 드러낼 여지가 있음"→"…세특·진로활동으로 더 또렷이 드러내면 좋음").

- [ ] **Step 2: case-02 ~ case-05 출력③ 점검·교체**

각 파일의 "## 기대 출력 ③ 부족 활동 보완안"을 읽고, **미반영 항목 신설 추천**(독서/자율동아리/수상/개인봉사/영재발명을 추가·신설·참가·준비·쌓으라)을 반영-항목 제안으로 교체한다. 각 케이스의 계열 특성은 유지. 변환 규칙(전 케이스 공통):
- 미반영 항목 *신설 추천* → 동일 관심을 **세특 탐구 / 교과–진로 연계 / 정규 창체 깊이 / 자기주도 정리**로 전환.
- *근거 인용*(이미 있는 기록 언급)은 유지 가능.
각 파일 편집 후, 본문이 미반영 추천을 남기지 않았는지 Step 5 게이트로 확인.

- [ ] **Step 3: 각 케이스 NG 셋 + README + definition**

각 case 파일의 "## §6 가드 위반 후보 키워드 (NG 셋)"에 1줄 추가:
```
- `improvements`에 미반영 항목(독서·자율동아리·수상·개인봉사·영재발명) 신설 추천 → NG (#20)
```
`docs/golden/README.md`의 출력③ 설명에 "미반영 항목 신설 추천 금지(근거 인용은 허용)" 한 줄 추가.
`docs/002_..._definition_v.3.md` §4-3 행의 보완안 설명을 "현행 반영 항목 중심(미반영 항목 신설 추천 제외)"으로 1절 보정 + 변경이력 행 추가.

- [ ] **Step 4: golden 회귀 게이트 테스트 작성**

Create `packages/shared/src/guardrails/golden-unreflected.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findUnreflectedRecommendations } from './unreflected-activities';

const CASES = [
  'case-01-park-junho.md',
  'case-02-kim-seoyeon.md',
  'case-03-lee-doyun.md',
  'case-04-choi-haeun.md',
  'case-05-park-minjun.md',
];

// 출력③ 섹션만 추출(헤더 '기대 출력 ③' ~ 다음 '## ' 전까지).
function output3(md: string): string {
  const start = md.indexOf('기대 출력 ③');
  if (start === -1) return '';
  const rest = md.slice(start);
  const next = rest.indexOf('\n## ', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('golden 출력③ — 미반영 항목 신설 추천 0건 (#20 회귀)', () => {
  for (const f of CASES) {
    it(f, () => {
      const md = readFileSync(
        fileURLToPath(new URL(`../../../../docs/golden/${f}`, import.meta.url)),
        'utf8'
      );
      expect(findUnreflectedRecommendations(output3(md))).toEqual([]);
    });
  }
});
```
> 경로 주: 이 테스트 파일은 `packages/shared/src/guardrails/`에 있으므로 repo 루트까지 `../../../../`. 실행 후 경로가 어긋나면(파일 못 읽음) 상대 깊이를 맞춘다.

- [ ] **Step 5: 회귀 게이트 실행**

Run: `pnpm --filter @pullim/shared test`
Expected: golden 5건 모두 출력③에 미반영 추천 0건으로 pass. 실패하는 케이스가 있으면 그 출력③의 미반영 추천 문구를 Step 2 규칙으로 교체.

- [ ] **Step 6: 게이트 + 커밋**

Run: `just check`
Expected: 통과.
**EPO 검수 게이트:** 승인 전 머지 금지.
```bash
git add docs/golden/ docs/002_Admissions_Coach_definition_v.3.md packages/shared/src/guardrails/golden-unreflected.test.ts
git commit -m "docs(golden): 보완안 반영-항목 전환 + 미반영 추천 회귀 게이트 (#20)

EPO(최선혜) 검수 필요: golden·정의 SSOT 변경.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (작성자 점검)

**Spec coverage:**
- §4 반영/미반영 분류 → Task 1(가드)·2(mock)·4(golden) ✓
- §5 프레이밍 전환 → Task 2(fitDelta·UI)·4(definition §4-3) ✓
- §6.1 shared 헬퍼 → Task 1 ✓ · §6.2 prompt → Task 3 ✓ · §6.3 golden → Task 4 ✓
- §8 테스트(shared 양성/음성 + golden 회귀) → Task 1·4 ✓
- 근거 인용 허용 vs 신설 추천 금지 → Task 1 음성 테스트 + 가드 설계로 강제 ✓

**Placeholder scan:** "TBD/적절히" 없음. Task 2 Step 3·Task 4 Step 4에 실제 코드/명령. Task 4 Step 2는 "유사"가 아니라 명시적 변환 규칙 + Step 1 worked example(case-01) 기반(케이스 02~05는 EPO 소유 실데이터라 읽어 규칙 적용; 게이트가 결과를 강제).

**Type consistency:** `flagsUnreflectedRecommendation`/`findUnreflectedRecommendations`/`UNREFLECTED_RECOMMENDATION_RE` 이름이 Task 1 정의와 Task 2·4 사용에서 일치. prompt §4.7 TERM/VERB 정규식이 코드 소스와 동일.

**리스크:** 추천-vs-인용 문맥 앵커 경계 케이스 — 핵심 케이스를 Task 1 음성 테스트로 고정, golden 게이트로 회귀 방어. SSOT는 EPO 게이트. `feat/19` 스택이라 #19 머지 후 #20 머지.
