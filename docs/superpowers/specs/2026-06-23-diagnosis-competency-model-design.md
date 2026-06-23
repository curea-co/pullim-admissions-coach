# 설계 — 학종 진단 평가요소 3역량 전환 (#19)

- 일자: 2026-06-23
- 작성: 브레인스토밍 세션 (Claude Code)
- 연관 이슈: [#19](https://github.com/curea-co/pullim-admissions-coach/issues/19) (본 설계), 연동 [#21](https://github.com/curea-co/pullim-admissions-coach/issues/21)(점수 뱃지·근거 표시)
- 상태: 설계 확정 대기 (EPO 검수 게이트는 구현 plan에서)

---

## 1. 배경 / 문제

현재 제품의 생기부 진단은 **5개 평가축**(`학업역량·진로역량·공동체역량·인성·기타`)을 쓰고, 각 축에 **강함/보통/약함 등급 뱃지**를 부여한다. 이는 현행 학종 평가 표준과 어긋난다.

### 입시 근거 (조사 확정)
- **2022년 5개 대학(건국대·경희대·연세대·중앙대·한국외대) 공동연구**가 기존 4요소(학업역량·전공적합성·인성·발전가능성)를 **3역량 + 10 평가항목**으로 개정했고, 다수 대학이 채택했다.
- **'인성'은 별도 축이 아니라 '공동체역량'에 흡수**됐다. '기타'는 표준에 없는 임의 축이다.
- 학종 서류평가는 **정성·종합 평가**다 — 입학사정관이 항목별 등급/점수를 공표하지 않는다. 따라서 `강함/보통/약함` 등급 뱃지는 거짓 정밀도를 준다.

### 공식 3역량 · 10항목 (본 설계의 기준 모델)
| 역량 | 평가항목 |
|---|---|
| 학업역량 (academic) | 학업성취도 · 학업태도 · 탐구력 |
| 진로역량 (career) | 전공(계열) 관련 교과 이수 노력 · 전공(계열) 관련 교과 성취도 · 진로 탐색 활동과 경험 |
| 공동체역량 (community) | 협업과 소통능력 · 나눔과 배려 · 성실성과 규칙준수 · 리더십 |

출처:
- NEW 학생부종합전형 공통 평가요소 및 평가항목(5개 대학): https://www.01consulting.co.kr/admissionsInfo/detail/23/11404
- 5개 대학 공동연구 평가요소: http://www.dhnews.co.kr/news/articleView.html?idxno=204038
- 평가항목 세부: https://www.edujin.co.kr/news/articleView.html?idxno=48012

---

## 2. 목표 / 비목표

**목표**
- 진단 모델을 **3역량(academic/career/community) + 10 평가항목** 구조로 전환한다.
- `인성`/`기타` 단독 축, `강함/보통/약함` 등급 뱃지를 제거한다 (#21 동시 해결).
- 항목 단위 **강점/보완 2단계 플래그**와 **근거(evidence) 가시화**를 도입한다.
- 전체 SSOT cascade(정의·프롬프트·골든)와 코드(스키마·mock·UI)를 정합화한다.

**비목표 (YAGNI / 별도 이슈)**
- 보완안이 2024 미반영 항목을 추천하는 문제 → #20.
- 면접 유형 분기 → #6.
- 항목별 점수화/수치화 → 도입하지 않음(정성 평가 원칙).
- 입력(student_profile) 스키마 변경 → 없음. 본 작업은 **출력(진단)** 한정.

---

## 3. 결정 사항 (브레인스토밍 확정)

| # | 결정 | 선택 |
|---|---|---|
| 작업 범위 | 전체 SSOT cascade (정의→prompt→golden 포함) | 확정 |
| 진단 입도 | 하이브리드: 3역량 카드 = 역량 정성 요약 + 항목별 강·약 하이라이트 | 확정 |
| 강도 표현 | 등급 제거 · 항목 2단계 `strength|gap` 플래그 (Option A) | 확정 |
| 출력 스키마 위치 | `apps/web` 로컬 타입 → **`packages/shared`로 승격** | 승인 |
| NG 가드 | §4에 `인성/기타` 단독·`강함/보통/약함` 등급 검출 추가 | 승인 |
| EPO 검수 게이트 | definition·prompt·golden 변경은 EPO(최선혜) 승인 후 머지 | 승인 |

---

## 4. 데이터 모델

진단 **출력** 스키마를 `packages/shared`로 승격한다(입력 스키마와 동일 위치 패턴, Phase D에서 NestJS·FE 공유).

### 4.1 상수 / enum
```
competency = 'academic' | 'career' | 'community'        // 학업 / 진로 / 공동체

COMPETENCY_LABEL = { academic:'학업역량', career:'진로역량', community:'공동체역량' }

COMPETENCY_ITEMS = {
  academic:  ['학업성취도', '학업태도', '탐구력'],
  career:    ['전공(계열) 관련 교과 이수 노력', '전공(계열) 관련 교과 성취도', '진로 탐색 활동과 경험'],
  community: ['협업과 소통능력', '나눔과 배려', '성실성과 규칙준수', '리더십'],
}

itemFlag = 'strength' | 'gap'        // ◎ 강점 / △ 보완 ('약함' 단정 없음)
```

### 4.2 진단 출력 스키마 (Zod)
```
DiagnosisCompetency = {
  competency,                 // 3종 enum, 중복 불가
  summary: string,            // 역량 정성 한 줄 (등급 아님)
  highlights: [               // 1건 이상
    {
      item: string,           // 반드시 COMPETENCY_ITEMS[competency] 중 하나
      flag: itemFlag,         // strength | gap
      evidence: string[],     // 1건 이상, 섹션 prefix 포함 (예: 세특-정보, 창체-동아리)
      note: string            // 관찰 한두 문장
    }
  ],
  nextSteps: string           // 주어=학생 본인, 시점=앞으로 (§6.1)
}

DiagnosisGuide = { criteria: DiagnosisCompetency[] }   // 정확히 3건
```

### 4.3 검증 규칙 (refine)
- `criteria`는 **정확히 3건**, `competency` 값이 academic/career/community 각각 1회.
- 각 `competency`의 `highlights` ≥ 1.
- 각 `highlight.item` ∈ `COMPETENCY_ITEMS[competency]`.
- 각 `highlight.evidence` ≥ 1, 모든 evidence가 **섹션 prefix 정규식** 통과(예: `^(세특|창체|진로활동|독서활동|행특|교과)`-... ). prefix 정규식은 prompt §6.2의 근거 가시화 규칙과 동일 소스 사용.
- 금지: 출력 내 `인성`/`기타`를 competency/항목으로 사용, `강함|보통|약함` 등급 라벨.

### 4.4 schema_version
- 진단 **출력** 구조 변경 → 출력 `schema_version` **`0.1` → `0.2`** bump.
- 입력 `SCHEMA_VERSION`(student_profile, `packages/shared/src/schemas.ts`)은 **변경 없음**(`0.1` 유지).

---

## 5. UI — `apps/web/app/result/page.tsx` DiagnosisPanel

- 3개 카드(학업/진로/공동체). 각 카드:
  - 헤더: 역량명 + `summary` 한 줄(정성, 등급 아님).
  - highlight 행: `◎ 강점`(emerald) / `△ 보완`(amber) 아이콘 + `item` + `note` + `evidence` 칩.
  - 푸터: `nextSteps`("앞으로 할 활동").
- 기존 `scoreStyle`(강함/보통/약함 뱃지) **제거**.
- 접근성: 카드 = `article`, highlight 플래그는 텍스트 라벨 동반(색상 단독 의존 금지).
- 입도/레이아웃은 브레인스토밍에서 승인한 하이브리드 미리보기 기준.

---

## 6. 프롬프트 cascade — `docs/prompt_v0.1.md`

- **§2 출력 JSON 스키마**: `diagnosis_guide.criteria` 5건 블록 → 3역량 구조. 각 criterion = `competency` + `summary` + `highlights[]`(`item`/`flag`/`evidence[]`/`note`) + `next_steps`. "정확히 5건" → "정확히 3건".
- **§5 평가 기준 매핑표**: 5항목 표 → 3역량 10항목 표로 재작성. 인성/기타 행 삭제. 각 항목별 "무엇을 보는가 / 출력 강조점".
- **§2 자기검토 체크리스트**: "진단 항목 5건" → "역량 3건 · 각 highlight `evidence` 1+ & 섹션 prefix · `인성`/`기타`/등급 라벨 0건".
- **§4 NG 정규식**: `4.6` 신설.
  - 진단 출력에 `"name"\s*:\s*"(인성|기타)"` 또는 항목으로서의 인성/기타 검출.
  - `(강함|보통|약함)` 등급 라벨 검출.
  - 매치 시 회귀 실패.
- **§"학교 유형별 보정" / "지원 학부별 톤"**: 유지하되 새 구조(역량/항목) 참조로 문구 조정.
- **§12 변경이력**: v0.3 항목 추가(3역량 전환, 출력 schema_version 0.2).

---

## 7. 정의 SSOT + 골든 cascade

- **`docs/002_..._definition_v.3.md`**
  - §4-2(현 51번 줄): "학종 평가 기준 5항목(…인성·기타) 매핑" → "학종 3역량(학업·진로·공동체) + 10 평가항목 매핑 + 역량별 강점·보완 + 학생 본인이 앞으로 할 활동".
  - §11 cascade 목록·변경이력에 본 전환 반영.
- **`docs/golden/case-01~05`**
  - 각 "## 기대 출력 ② 생기부 진단 가이드"를 새 구조로 재작성: 5항목×(강/보/약·관찰·앞으로) → 3역량×(summary · 강·약 항목 하이라이트 · evidence · next_steps).
  - 각 케이스 "§6 가드 위반 후보 키워드(NG 셋)"에 `인성/기타 단독 항목`·`강함|보통|약함 등급` 가드 추가.
- **`docs/golden/README.md` §2**: 케이스 파일 구조의 "기대 출력 ②" 설명을 3역량 구조로 갱신.
- ⚠️ **EPO 검수 게이트**: definition·prompt·golden 변경은 EPO(최선혜) 소유 SSOT → 구현 plan에서 머지 전 EPO 승인 단계를 명시.

---

## 8. 테스트

- **shared 단위테스트**: DiagnosisGuide Zod 스키마 — (a) 정상 3역량 통과, (b) criteria≠3건 실패, (c) item이 역량 항목 밖이면 실패, (d) evidence 0건/섹션 prefix 누락 실패, (e) `인성`/`기타`/`강함|보통|약함` 포함 실패.
- **UI 렌더 테스트**: 새 mock으로 DiagnosisPanel이 3카드·강/보완 플래그·evidence 칩 렌더, 등급 뱃지 부재.
- **골든 회귀 가드**: §4.6 NG 정규식이 새 NG 셋과 함께 컴파일·매치 0건.

---

## 9. 작업 순서 (구현 plan 입력)

1. `packages/shared`: 진단 출력 스키마·상수·enum 추가 + 단위테스트.
2. **SSOT 문서**: definition §4-2 + prompt §5/§2/§4 갱신 → **[EPO 검수 게이트]**.
3. `apps/web`: mock(park-junho 진단부)·result DiagnosisPanel을 새 모델로 교체.
4. golden 5건 + README 갱신.
5. 테스트 정리 + 골든 NG 가드 확인.

---

## 10. 영향 범위 / 리스크

- **영향 파일**: `packages/shared/src/{schemas.ts,index.ts}`, `apps/web/lib/mock/park-junho.ts`, `apps/web/app/result/page.tsx`, `apps/web/components/guardrail-label.tsx`(진단 카피 점검), `docs/002_..._definition_v.3.md`, `docs/prompt_v0.1.md`, `docs/golden/*`.
- **리스크**
  - SSOT 문서는 EPO 소유 → 검수 없이 머지 금지(게이트로 차단).
  - 출력 schema_version bump(0.2) → Phase D 골든 회귀 재실행 필요(아직 Phase D 코드 없음, 문서 정합만 확보).
  - mock 진단부 전면 교체 → result 페이지 회귀 확인 필요(렌더 테스트로 커버).
- **하위호환**: 입력 스키마 불변이라 submit/consent/processing 흐름 영향 없음.
