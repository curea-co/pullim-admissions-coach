# 면접 준비 팩 유형 분기 Implementation Plan (#22)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 면접 준비 팩을 3유형(학생부 기반/제시문 기반/의대 MMI·윤리)으로 분기하고, 주요 ~15개 대학의 면접 유형 데이터셋 + `target_track`/대학 기반 `lookupInterviewFormats`로 적절한 유형을 선택하며, MMI/제시문에도 §6.2 대본·모범답안 금지를 강제한다.

**Architecture:** 유형 taxonomy·대학 데이터셋·lookup은 `packages/shared`(순수·테스트, Phase D 서버가 user-message에 주입). prompt가 유형별 생성 규칙을 코드화. mock/golden/UI는 시연. 데이터셋(~15개 대학 실제 면접 유형)은 EPO 검수 대상이며 리서치+검증으로 채운다.

**Tech Stack:** TypeScript 5.5.4, Zod ^3.23.8, Vitest ^2.1, React 18 / Next 14.

## Global Constraints

- **3 유형:** `record_based`(학생부 기반·기본) / `passage_based`(제시문 기반) / `mmi`(의대 MMI·윤리).
- **evidence(생기부 근거) ≥1 + 섹션 prefix 규칙은 `record_based` 질문에만.** MMI/제시문 질문은 evidence 빈 배열 허용(생기부 기반 아님).
- **§6.2 대본 금지를 전 유형에 적용:** MMI/제시문도 *사고 방향/프레임*만(생명윤리 4원칙 등), **모범답안·정답·대본 금지**.
- 데이터셋은 `INTERVIEW_FORMATS_VERSION`(연도) 표기 + **EPO(최선혜) 검수**(매년 변동, 부정확 시 학생 오도). 미매칭 대학 → `DEFAULT_FORMATS_BY_TRACK[track]` fallback(medical→[record_based, mmi], else→[record_based]).
- 명칭 "학종 면접 준비 팩" 유지. 입력 스키마 불변. node>=20.11, pnpm 9.7.0, zod ^3.23.8.
- **EPO 게이트:** prompt·golden·definition·**데이터셋(Task 2)** 은 승인 전 머지 금지.

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `packages/shared/src/interview-formats.ts` (생성) | format 타입·라벨·lookup·기본값·시드 데이터셋 | 1 |
| `packages/shared/src/interview-formats.test.ts` (생성) | lookup 로직 단위테스트 | 1 |
| `packages/shared/src/index.ts` (수정) | barrel export | 1 |
| `packages/shared/src/interview-formats.ts` (확장) | ~15개 대학 데이터셋 리서치 채움 | 2 |
| `apps/web/lib/mock/park-junho.ts` (수정) | InterviewQuestion에 `format` + 질문 태그 | 3 |
| `apps/web/app/result/page.tsx` (수정) | 면접 질문 유형 배지 | 3 |
| `docs/prompt_v0.1.md` (수정) | §2/§3/§5/§6.2/§4 유형 분기 | 4 |
| `docs/golden/case-03-lee-doyun.md` (수정) | MMI 질문 추가 + format 태그 | 5 |
| `docs/002_..._definition_v.3.md`·`docs/golden/README.md` (수정) | §4-1 카피·구조 | 5 |

---

### Task 1: 유형 taxonomy + lookup (`packages/shared`)

**Files:**
- Create: `packages/shared/src/interview-formats.ts`, `packages/shared/src/interview-formats.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `TargetTrack` (schemas.ts).
- Produces (Task 2·3·4 의존):
  - `type InterviewFormat = 'record_based' | 'passage_based' | 'mmi'`
  - `INTERVIEW_FORMAT_LABEL: Record<InterviewFormat, string>`
  - `INTERVIEW_FORMATS_VERSION: string`
  - `interface UniversityInterviewFormat { formats: InterviewFormat[]; weightPct?: [number, number]; notes?: string }`
  - `UNIVERSITY_INTERVIEW_FORMATS: Record<string, UniversityInterviewFormat>`
  - `DEFAULT_FORMATS_BY_TRACK: Record<TargetTrack, InterviewFormat[]>`
  - `lookupInterviewFormats(universities: { name: string }[], track: TargetTrack): InterviewFormat[]`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `packages/shared/src/interview-formats.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  lookupInterviewFormats,
  INTERVIEW_FORMAT_LABEL,
  UNIVERSITY_INTERVIEW_FORMATS,
} from './interview-formats';

describe('lookupInterviewFormats', () => {
  it('medical 계열은 미매칭이어도 mmi 기본 포함', () => {
    const f = lookupInterviewFormats([{ name: '무명대학교' }], 'medical');
    expect(f).toContain('record_based');
    expect(f).toContain('mmi');
  });
  it('비의대·미매칭은 학생부 기반만', () => {
    expect(lookupInterviewFormats([{ name: '무명대학교' }], 'humanities')).toEqual(['record_based']);
  });
  it('대학 미입력은 계열 기본값', () => {
    expect(lookupInterviewFormats([], 'science_engineering')).toEqual(['record_based']);
  });
  it('서울대학교는 제시문 기반 포함', () => {
    const f = lookupInterviewFormats([{ name: '서울대학교' }], 'humanities');
    expect(f).toContain('passage_based');
  });
  it('공백 정규화 매칭(서울 대학교)', () => {
    const f = lookupInterviewFormats([{ name: '서울 대학교' }], 'humanities');
    expect(f).toContain('passage_based');
  });
  it('중복 제거', () => {
    const f = lookupInterviewFormats([{ name: '서울대학교' }, { name: '서울대학교' }], 'humanities');
    expect(new Set(f).size).toBe(f.length);
  });
});

describe('데이터셋·라벨', () => {
  it('라벨 3종', () => {
    expect(INTERVIEW_FORMAT_LABEL.record_based).toBe('학생부 기반');
    expect(INTERVIEW_FORMAT_LABEL.passage_based).toBe('제시문 기반');
    expect(INTERVIEW_FORMAT_LABEL.mmi).toBe('의대 MMI');
  });
  it('모든 데이터셋 항목은 비어있지 않은 formats', () => {
    for (const [, v] of Object.entries(UNIVERSITY_INTERVIEW_FORMATS)) {
      expect(v.formats.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: FAIL — `Cannot find module './interview-formats'`.

- [ ] **Step 3: 구현 (시드 데이터셋 포함)**

Create `packages/shared/src/interview-formats.ts`:
```ts
// Pullim Admissions Coach — 면접 유형 분기 (#22)
// 학생부 기반 / 제시문 기반 / 의대 MMI. 데이터셋은 연도별 변동 → 버전 표기 + EPO 검수.
// Phase D 서버가 lookupInterviewFormats 결과를 user-message에 주입.

import type { TargetTrack } from './schemas';

export type InterviewFormat = 'record_based' | 'passage_based' | 'mmi';

export const INTERVIEW_FORMAT_LABEL: Record<InterviewFormat, string> = {
  record_based: '학생부 기반',
  passage_based: '제시문 기반',
  mmi: '의대 MMI',
};

// 데이터셋 버전(연도). 면접 유형은 매년 변동하므로 갱신 시 함께 올린다.
export const INTERVIEW_FORMATS_VERSION = '2026.1' as const;

export interface UniversityInterviewFormat {
  formats: InterviewFormat[];
  weightPct?: [number, number];
  notes?: string;
}

// 주요 대학 면접 유형. Task 2에서 ~15개로 확장(리서치+EPO 검수). 키 = 정식 대학명.
export const UNIVERSITY_INTERVIEW_FORMATS: Record<string, UniversityInterviewFormat> = {
  서울대학교: {
    formats: ['passage_based', 'record_based'],
    notes: '제시문 기반 + 서류 기반, 복수 면접실 60분 내외(의대는 MMI 별도)',
  },
};

export const DEFAULT_FORMATS_BY_TRACK: Record<TargetTrack, InterviewFormat[]> = {
  humanities: ['record_based'],
  science_engineering: ['record_based'],
  medical: ['record_based', 'mmi'],
  arts_athletics: ['record_based'],
  other: ['record_based'],
};

function normalize(name: string): string {
  return name.replace(/\s/g, '');
}

export function lookupInterviewFormats(
  universities: { name: string }[],
  track: TargetTrack
): InterviewFormat[] {
  const out = new Set<InterviewFormat>(DEFAULT_FORMATS_BY_TRACK[track]);
  const byNorm = new Map(
    Object.entries(UNIVERSITY_INTERVIEW_FORMATS).map(([k, v]) => [normalize(k), v])
  );
  for (const u of universities) {
    const entry = byNorm.get(normalize(u.name));
    if (entry) for (const f of entry.formats) out.add(f);
  }
  // 안정 순서: record_based → passage_based → mmi
  const order: InterviewFormat[] = ['record_based', 'passage_based', 'mmi'];
  return order.filter((f) => out.has(f));
}
```

- [ ] **Step 4: barrel export**

`packages/shared/src/index.ts` 끝에 추가:
```ts
export * from './interview-formats';
```

- [ ] **Step 5: 테스트 통과 + 타입체크**

Run: `pnpm --filter @pullim/shared test && pnpm --filter @pullim/shared typecheck`
Expected: 본 태스크 테스트 + 기존 전부 pass, typecheck 무에러.

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/interview-formats.ts packages/shared/src/interview-formats.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): 면접 유형 taxonomy + lookupInterviewFormats + 시드 데이터셋 (#22)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 대학별 데이터셋 ~15개 리서치 확장 (EPO 검수)

> 이 태스크는 **리서치 집약**이다. 컨트롤러는 실행 시 대학별 병렬 리서치+검증 워크플로로 채울 수 있다. 각 항목은 **출처·연도(2026 입시 기준)** 근거가 있어야 하며 EPO 검수 대상이다.

**Files:**
- Modify: `packages/shared/src/interview-formats.ts` (`UNIVERSITY_INTERVIEW_FORMATS` 확장)

**Interfaces:**
- Consumes: Task 1 `UniversityInterviewFormat` 구조.

- [ ] **Step 1: 실패하는 테스트 추가**

`packages/shared/src/interview-formats.test.ts`의 `데이터셋·라벨` describe에 추가:
```ts
  it('주요 면접 대학 15개 이상 + 핵심 대학 포함', () => {
    const keys = Object.keys(UNIVERSITY_INTERVIEW_FORMATS);
    expect(keys.length).toBeGreaterThanOrEqual(15);
    for (const must of ['서울대학교', '고려대학교', '연세대학교']) {
      expect(keys).toContain(must);
    }
  });
  it('formats 값은 알려진 InterviewFormat만', () => {
    const allowed = new Set(['record_based', 'passage_based', 'mmi']);
    for (const [, v] of Object.entries(UNIVERSITY_INTERVIEW_FORMATS)) {
      for (const f of v.formats) expect(allowed.has(f)).toBe(true);
    }
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @pullim/shared test`
Expected: FAIL — 데이터셋이 1개(서울대)뿐이라 "15개 이상" 실패.

- [ ] **Step 3: 데이터셋 확장 (리서치+검증)**

`UNIVERSITY_INTERVIEW_FORMATS`를 주요 ~15개 대학으로 확장한다. 대상: SKY + 주요 인서울(성균관대·한양대·경희대·서강대·중앙대·이화여대 등) + 의대 MMI 핵심(가톨릭대·성균관대 의대·울산대 등). 각 대학마다 **2026 입시 기준 면접 유형**을 입시 공식 자료(모집요강·대학 입학처)로 확인해 `formats`(+있으면 `weightPct`·`notes`)를 기입한다. 규칙:
- 학종 일반 면접 = `record_based`. 제시문/사고력 면접 운영 대학 = `passage_based` 추가. 의대 MMI 운영 = 해당 대학에 `mmi` 포함(또는 의대 한정 notes).
- 면접 미실시(서류 100%) 대학은 데이터셋에 넣지 않거나 `notes: '서류 100%(면접 없음)'`로 표기.
- 불확실하면 보수적으로 `record_based`만 두고 `notes`에 "확인 필요" 기록 → EPO 검수에서 보강.
- 각 항목 출처는 커밋 메시지/PR 본문 또는 코드 주석으로 남긴다.

- [ ] **Step 4: 테스트 통과**

Run: `pnpm --filter @pullim/shared test && pnpm --filter @pullim/shared typecheck`
Expected: 15개 이상 + 핵심 대학 포함 + formats 유효, 전부 pass.

- [ ] **Step 5: 게이트 + 커밋 (EPO)**

Run: `just check`
**EPO 검수 게이트:** 데이터셋 정확성은 EPO 승인 전 머지 금지.
```bash
git add packages/shared/src/interview-formats.ts packages/shared/src/interview-formats.test.ts
git commit -m "feat(shared): 대학별 면접 유형 데이터셋 ~15개 확장(2026 기준) (#22)

EPO(최선혜) 검수 필요: 대학 면접 유형 정확성(연도 변동).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: mock + result UI 유형 배지 (`apps/web`)

**Files:**
- Modify: `apps/web/lib/mock/park-junho.ts`, `apps/web/app/result/page.tsx`

**Interfaces:**
- Consumes: Task 1 `type InterviewFormat`, `INTERVIEW_FORMAT_LABEL`.

- [ ] **Step 1: mock 타입 + 질문에 format**

`apps/web/lib/mock/park-junho.ts`:
1) import에 추가:
```ts
import type { TargetTrack, SchoolType, DiagnosisGuide, InterviewFormat } from '@pullim/shared';
```
2) `InterviewQuestion` 타입에 `format` 추가:
```ts
export type InterviewQuestion = {
  question: string;
  format: InterviewFormat;
  direction: string;
  evidence: string[];
  followUp: string;
};
```
3) `interviewPack.questions`의 **3개 질문 각각에 `format: 'record_based'`** 추가(예: 첫 질문):
```ts
      {
        question:
          '학교생활 중 가장 의미 있게 참여한 활동과 그 활동이 본인에게 어떤 영향을 주었는지 말해주세요.',
        format: 'record_based',
        direction:
          '코딩 동아리 활동과 진로 탐색을 잇는 흐름으로 답변. 결과보다 *과정에서 배운 것*에 무게.',
        evidence: [
          '창체-동아리(코딩 동아리, 2년 연속 활동)',
          '진로활동-진로탐색 보고서(소프트웨어 엔지니어)',
          '세특-정보 과목(자료구조 발표)',
        ],
        followUp: '그 활동에서 가장 어려웠던 점은 무엇이었고 어떻게 해결했나요?',
      },
```
(2·3번째 질문도 동일하게 `format: 'record_based'` 추가.)

- [ ] **Step 2: result InterviewPanel 유형 배지**

`apps/web/app/result/page.tsx`:
1) import에 `INTERVIEW_FORMAT_LABEL` 추가(기존 `@pullim/shared` import에 합침):
```ts
import { competencyLabel, formatStandingLabel, INTERVIEW_FORMAT_LABEL } from '@pullim/shared';
```
2) `InterviewPanel`의 질문 헤더(`<header className="flex items-baseline gap-3">` 내 `Q{idx+1}` 배지 옆)에 유형 배지 추가:
```tsx
          <header className="flex flex-wrap items-baseline gap-2">
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              Q{idx + 1}
            </span>
            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">
              {INTERVIEW_FORMAT_LABEL[q.format]}
            </span>
            <h3 className="text-base font-semibold leading-snug text-ink-900">
              {q.question}
            </h3>
          </header>
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `pnpm --filter @pullim/web typecheck && pnpm --filter @pullim/web build`
Expected: 무에러, 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/lib/mock/park-junho.ts apps/web/app/result/page.tsx
git commit -m "feat(web): 면접 질문 유형 배지 + mock format 필드 (#22)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 프롬프트 cascade — 유형 분기 (EPO 검수)

**Files:**
- Modify: `docs/prompt_v0.1.md`

- [ ] **Step 1: §6.2 면접 3유형 규칙 추가**

`docs/prompt_v0.1.md` §6.2의 "절대 금지" 위(또는 ②③ 설명 뒤)에 유형 분기 문단을 추가:
```
### 면접 유형 분기 (#22)
면접 팩의 각 질문에는 `format`을 부여한다: `record_based`(학생부 기반·기본) / `passage_based`(제시문 기반) / `mmi`(의대 MMI·윤리).
- record_based: ① 방향 ② **생기부 근거(evidence ≥1, 섹션 prefix)** ③ 꼬리질문.
- passage_based: 자료를 *분석·논리적으로 해석*하는 접근법(논점 잡기·근거 구성 방향)만. evidence 없음. **정답·모범답안 금지.**
- mmi: 의료 현장 상황·윤리 딜레마에 대한 *사고 방향* — **생명윤리 4원칙(자율성·선행·악행금지·정의)** 으로 장단점을 분석하는 틀, 상황판단·의사소통 강조. evidence 없음. **모범답안·정답·대본 금지.** 특정 연도 기출 주제를 단정적으로 외우게 하지 않는다.
- 생성할 유형은 사용자 메시지에 주입된 `면접 유형`(target_track·목표 대학 기반)을 따른다. 미지정 시 record_based.
```

- [ ] **Step 2: §2 JSON에 format + evidence 범위**

§2 출력 JSON의 `interview_pack.questions[]` 항목에 `"format"`을 추가하고 evidence 주석을 범위 한정으로 수정:
```
      {
        "question": "<한국어 예상 질문>",
        "format": "record_based" | "passage_based" | "mmi",
        "direction": "<한 문장으로 좁힌 답변/접근 방향>",
        "evidence": ["<생기부 항목>", ...],   // record_based만 필수(≥1, 섹션 prefix). passage_based·mmi는 빈 배열.
        "follow_up": "<꼬리질문 1건>"
      }
```

- [ ] **Step 3: §3 user-message에 면접 유형 주입**

§3 사용자 메시지 형식에 한 줄 추가(프로필 블록 내):
```
- 면접 유형(목표 대학·계열 기반, lookupInterviewFormats 결과): {interview_formats}
```
그리고 응답 요건에 "각 면접 질문의 `format`은 위 면접 유형 중 하나" 한 줄 추가.

- [ ] **Step 4: §2 자기검토 체크리스트 조정**

evidence 규칙을 record_based 한정으로 수정하고 유형 대본 금지를 추가(번호는 현재 최대+1로):
```
- 면접 질문 중 `record_based`는 evidence ≥1 + 섹션 prefix. `passage_based`/`mmi`는 evidence 빈 배열 허용.
- 모든 유형에서 대본·모범답안·정답 문장 0건(MMI/제시문 포함).
```

- [ ] **Step 5: §4 NG + §5/톤**

§4에 NG 추가(코드 펜스):
```
### 4.8 면접 유형 대본화 NG (#22)
모범\s*답안
정답(은|입니다|:)
(이렇게|다음과\s*같이)\s*답변하면\s*(됩니다|좋)
```
§"지원 학부별 톤" medical 항목에 "면접은 MMI(생명윤리·상황판단) 대비 포함" 한 절 추가.

- [ ] **Step 6: 게이트 + 커밋 (EPO)**

Run: `just check`
**EPO 검수 게이트.**
```bash
git add docs/prompt_v0.1.md
git commit -m "docs(prompt): 면접 3유형 분기(§6.2/§2/§3/§4) + MMI 대본 금지 (#22)

EPO(최선혜) 검수 필요: 프롬프트 SSOT.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: golden case-03 MMI 시연 + 정의·README (EPO 검수)

**Files:**
- Modify: `docs/golden/case-03-lee-doyun.md`, `docs/002_Admissions_Coach_definition_v.3.md`, `docs/golden/README.md`

- [ ] **Step 1: case-03 기존 질문에 유형 태그 + MMI 질문 추가**

`docs/golden/case-03-lee-doyun.md`의 "## 기대 출력 ① 학종 면접 준비 팩"에서:
1) 기존 Q1·Q2·Q3 각 항목에 유형 표기 추가(예: Q1 제목 줄 아래 `- **유형:** 학생부 기반(record_based)`).
2) MMI 질문 Q4를 추가(evidence 없음, 생명윤리 4원칙 사고 방향, 대본 금지):
```
### Q4 (의대 MMI · 윤리)
**질문:** 한정된 의료자원(예: 중환자실 병상 1개)을 두고 두 환자의 상태가 비슷할 때, 어떤 기준으로 판단할지 본인의 사고 과정을 말해주세요.

- **유형:** 의대 MMI(mmi)
- **답변 방향:** 정답을 정하지 말 것. 생명윤리 4원칙(자율성·선행·악행금지·정의)으로 *각 선택지의 장단점*을 짚고, 본인이 무엇을 더 중요하게 보는지와 *그 한계*까지 언급. 의사소통: 상대 입장도 이해하는 태도.
- **근거 생기부 항목:** (없음 — 가상 상황 면접)
- **꼬리질문 대비:** 만약 한 환자가 본인의 가족이라면 판단이 달라질까요? 그 이유는?
```

- [ ] **Step 2: NG 셋 보강**

case-03의 "## §6 가드 위반 후보 키워드 (NG 셋)"에 추가:
```
- 면접(특히 MMI/제시문) 출력에 모범답안·정답·완성 대본 → NG (#22)
```

- [ ] **Step 3: definition §4-1 + README**

`docs/002_..._definition_v.3.md` §4-1(면접 준비 팩) 행에 "면접 유형(학생부 기반/제시문 기반/의대 MMI) 분기" 한 절 추가 + 변경이력 행. `docs/golden/README.md` 출력① 설명에 "질문별 유형(record_based/passage_based/mmi); MMI/제시문은 생기부 근거 없음·대본 금지" 한 줄 추가.

- [ ] **Step 4: 게이트 + 커밋 (EPO)**

Run: `just check`
**EPO 검수 게이트.**
```bash
git add docs/golden/case-03-lee-doyun.md docs/002_Admissions_Coach_definition_v.3.md docs/golden/README.md
git commit -m "docs(golden): case-03 의대 MMI 면접 시연 + 유형 태그 + 정의 §4-1 (#22)

EPO(최선혜) 검수 필요: golden·정의 SSOT.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (작성자 점검)

**Spec coverage:**
- §4 taxonomy+스키마(format, evidence 범위) → Task 1·3·4 ✓
- §5 데이터셋+lookup → Task 1(로직·시드)·2(확장) ✓
- §6 프롬프트 cascade(§6.2/§2/§3/§5/§4) → Task 4 ✓
- §7 시연(golden case-03 MMI + UI 배지) → Task 3·5 ✓
- §9 테스트(lookup·데이터셋·golden) → Task 1·2·5 ✓
- §6.2 대본 금지 MMI/제시문 확장 → Task 4 §4.8 NG + golden NG ✓ · evidence record_based 한정 → Task 4 §2 체크리스트 ✓

**Placeholder scan:** Task 2 Step 3은 "리서치+검증"으로 실제 데이터를 채우는 콘텐츠 태스크(EPO 소유) — 명시적 규칙 + 테스트(≥15·핵심대학·유효 formats)로 결과를 강제. 코드 step엔 완전한 코드.

**Type consistency:** `InterviewFormat`/`INTERVIEW_FORMAT_LABEL`/`lookupInterviewFormats`/`UNIVERSITY_INTERVIEW_FORMATS`/`DEFAULT_FORMATS_BY_TRACK` 이름이 Task 1 정의와 Task 2·3·4 사용에서 일치. mock `InterviewQuestion.format`이 shared `InterviewFormat`과 일치.

**리스크:** 데이터셋 정확도(매년 변동) → 버전 표기 + EPO 게이트 + 테스트로 구조 강제. §6.2 MMI 대본 금지 → §4.8 NG + golden NG. `feat/25` 스택 → 선행 PR 머지 후.
