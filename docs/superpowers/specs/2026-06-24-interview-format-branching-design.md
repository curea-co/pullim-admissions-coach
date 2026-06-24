# 설계 — 면접 준비 팩 유형 분기 (학생부/제시문/의대 MMI) (#22)

- 일자: 2026-06-24
- 작성: 브레인스토밍 세션 (Claude Code)
- 연관 이슈: [#22](https://github.com/curea-co/pullim-admissions-coach/issues/22) (P1). `feat/25` 위 스택.
- 상태: 설계 확정 대기

---

## 1. 배경 / 문제

면접 준비 팩이 **대학·전형별 면접 유형을 전혀 반영하지 않는다.** 모든 학생에게 동일한 학생부 기반 질문만 준다(현 mock 3건, 전부 학생부 기반·공학 가정). 특히 의대(`medical`) 지망생은 정작 필요한 **MMI/윤리** 대비를 못 받고 일반 학생부 질문만 받는다.

### 입시 근거 (조사)
- **학생부 기반 면접**: 대다수 학종. 자소서 폐지로 검토 자료가 생기부뿐이라, 활동의 *문제의식→과정→확장*과 진위를 파고든다.
- **제시문 기반 면접**: 서울대·고려대·연세대 등 상위권. 주어진 자료를 분석·논리적으로 해석하는 *사고력*을 평가.
- **의대 MMI(다중미니면접)**: 복수 면접실 순환, 상황 제시형. 평가요소=전공적합성·발전역량·인성(상황판단·문제해결·팀워크·윤리적 판단·의사소통). **생명윤리 4원칙(자율성·선행·악행금지·정의)** 기반 *상황·윤리 딜레마*. 면접 비중 대학별 30~60%.

출처:
- 학종 면접 유형별 대비: https://www.jinhak.com/jh/high3/univ-entrance-info/ipsi-analysis/ipsi-strategy/824841
- 제시문 기반 면접: https://www.edujin.co.kr/news/articleView.html?idxno=47936
- 의대 MMI/인적성: https://www.jinhak.com/jh/high3/univ-entrance-info/ipsi-analysis/ipsi-strategy/822216

## 2. 목표 / 비목표

**목표**
- 면접 팩을 **3 유형**(학생부 기반/제시문 기반/의대 MMI·윤리)으로 분기.
- `target_track`(특히 medical)·목표 대학에 따라 적절한 유형 질문을 생성.
- 주요 ~15개 대학의 면접 유형 데이터셋(연도·버전 표기, EPO 검수)을 shared에 두고 Phase D user-message가 주입.
- §6.2 대본 금지를 MMI/제시문까지 확장(사고 *방향/프레임*만, 모범답안·정답 금지).

**비목표 (YAGNI)**
- 모든 대학 면접 유형 망라(~15개 핵심 + 계열 fallback). 추가 대학은 후속.
- 실제 AI 생성·서버 주입 = Phase D(데이터셋·lookup·프롬프트 규칙만 준비).
- 면접 실전 모의(녹음·피드백) 등 = 별개.

## 3. 결정 사항 (브레인스토밍 확정)

| # | 결정 | 선택 |
|---|---|---|
| 유형 범위 | 3 유형(record_based/passage_based/mmi) + 대학별 데이터셋 | 확정 |
| 데이터셋 폭 | 주요 면접 대학 ~15개 + 계열 fallback | 확정 |
| evidence 규칙 | `record_based`에만 적용(MMI/제시문은 생기부 기반 아님) | 확정 |
| MMI 시연 | golden case-03(의치한)에 MMI 질문 + result UI 유형 배지 | 확정 |
| 브랜치 | `feat/25` 위 스택 | 확정 |

## 4. 유형 taxonomy + 스키마

```
InterviewFormat = 'record_based' | 'passage_based' | 'mmi'
```
| format | 라벨 | 무엇을 | evidence |
|---|---|---|---|
| record_based | 학생부 기반 | 활동의 동기·과정·확장, 진위 | 생기부 항목 인용(≥1, 섹션 prefix) |
| passage_based | 제시문 기반 | 자료 분석·논리 *접근법* | 없음(사고 과정) |
| mmi | 의대 MMI·윤리 | 상황·윤리 딜레마, 생명윤리 4원칙·상황판단·의사소통 *방향* | 없음(가상 상황) |

- prompt §2 JSON의 각 질문에 `format` 필드 신설.
- **evidence ≥1 & 섹션 prefix 규칙은 `record_based` 질문에만** 적용(#19 v0.2 자기검토 7번 조정). MMI/제시문 질문은 evidence 빈 배열 허용.
- 공통: ① 답변 *방향*, ③ 꼬리질문은 전 유형 유지. ② evidence는 record_based 전용.

## 5. 대학별 데이터셋 (`packages/shared/src/interview-formats.ts`)

```
export const INTERVIEW_FORMATS_VERSION = '2026.1' as const;  // 연도·버전(매년 변동)

export type InterviewFormat = 'record_based' | 'passage_based' | 'mmi';

export interface UniversityInterviewFormat {
  formats: InterviewFormat[];   // 해당 대학 면접 유형
  weightPct?: [number, number]; // 면접 반영 비중 범위(있으면)
  notes?: string;               // 예: '복수 면접실 60분', 'MMI 순환'
}

export const UNIVERSITY_INTERVIEW_FORMATS: Record<string, UniversityInterviewFormat>; // 주요 ~15개

export const DEFAULT_FORMATS_BY_TRACK: Record<TargetTrack, InterviewFormat[]>;
// medical: ['record_based','mmi'], 그 외: ['record_based']

export function lookupInterviewFormats(
  universities: { name: string }[],
  track: TargetTrack
): InterviewFormat[];  // 매칭 대학 formats union + 계열 fallback, 중복 제거, 안정 순서
```
- 키는 대학 정식명(예: '서울대학교'). 매칭은 정규화(공백·'대'/'대학교' 변형 허용) 후 비교.
- **데이터셋 ~15개 대학의 실제 면접 유형·비중은 EPO 검수 대상**(golden과 동급). 실행 중 **대학별 병렬 리서치+검증**으로 채우고 출처·연도 기록.
- 매칭 대학이 없으면 `DEFAULT_FORMATS_BY_TRACK[track]`로 fallback.

## 6. 프롬프트 cascade (`docs/prompt_v0.1.md`)

- **§6.2**: 면접 3유형 규칙 추가. 각 유형이 주는 것:
  - record_based: 방향 + 생기부 근거 + 꼬리질문.
  - passage_based: 자료 해석 *접근법*(논점 잡기·근거 구성 방향), **정답·모범답안 금지**.
  - mmi: 상황·윤리 딜레마에 대한 *사고 방향*(생명윤리 4원칙으로 장단점 분석 틀), **모범답안·정답 금지**, 의사소통·상황판단 강조.
- **§2 JSON**: `interview_pack.questions[].format` 신설. evidence는 record_based만 필수.
- **§3 user-message**: `lookupInterviewFormats(target_universities, target_track)` 결과(유형 목록 + 대학 notes)를 주입해 생성 유형을 지정.
- **§2 자기검토 체크리스트**: evidence ≥1+prefix를 record_based 질문 한정으로 수정 + 전 유형 "대본·모범답안·정답 0건" 추가.
- **§4 NG**: "모범답안", "정답(은|입니다)" 패턴 추가(제시문/MMI 대본화 차단). 기존 합격답변/면접답변 유지.
- **§5/§"계열별 톤"**: medical → MMI(생명윤리·상황판단) 명시.

## 7. 시연 (golden / UI)

- **golden case-03 이도윤(특목고·의치한)**: 면접 팩에 MMI/윤리 질문 1건 추가(예: 생명윤리 딜레마 상황 + 4원칙 사고 방향, evidence 빈 배열, **대본 금지**). 기존 학생부 기반 질문과 공존. format 필드 반영.
- **result `InterviewPanel`**: 각 질문에 **유형 배지**(학생부 기반/제시문 기반/의대 MMI) 표시. park-junho mock 질문에 `format: 'record_based'` 추가(기본).

## 8. 영향 파일
- 신규: `packages/shared/src/interview-formats.ts`(+test), `packages/shared/src/index.ts`(barrel)
- 수정(코드): `apps/web/lib/mock/park-junho.ts`(interviewPack에 format), `apps/web/app/result/page.tsx`(유형 배지)
- 수정(SSOT, **EPO 검수**): `docs/prompt_v0.1.md`(§2/§3/§5/§6.2/§4), `docs/golden/case-03-lee-doyun.md`(+ 필요 시 타 케이스 format), `docs/002_..._definition_v.3.md` §4-1, `docs/golden/README.md`

## 9. 테스트
- **shared 단위테스트:** `lookupInterviewFormats` — medical→mmi 포함, 매칭 대학 formats union, 미매칭 → 계열 fallback, 대학명 정규화 매칭, 중복 제거·안정 순서. 데이터셋 스키마(formats 비어있지 않음, 알려진 InterviewFormat 값).
- **golden:** case-03 면접 팩에 mmi 질문 존재 + §6.2 대본/모범답안 위반 0건(NG).
- **web:** typecheck + build + 수동(유형 배지 노출).

## 10. 리스크 / 하위호환
- **데이터셋 정확도·유지보수:** 면접 유형은 매년 변동 → `INTERVIEW_FORMATS_VERSION` 연도 표기 + EPO 검수 + 출처 기록. 부정확 데이터가 학생을 오도할 수 있어 EPO 게이트 필수(golden 동급).
- **§6.2 가드:** MMI/제시문도 모범답안·대본 금지 — 윤리 딜레마에 "정답"을 주지 않고 *사고 틀*만. NG로 강제.
- evidence 규칙 완화(record_based 한정) → #19 자기검토 7번과 정합 재확인 필요.
- 입력 스키마 불변. `feat/25` 스택 → #19·#20·#25 머지 후 #22 머지.
