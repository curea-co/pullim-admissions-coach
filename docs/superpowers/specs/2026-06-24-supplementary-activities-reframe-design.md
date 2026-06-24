# 설계 — 부족 활동 보완안 현행 반영 항목 재설계 (#20)

- 일자: 2026-06-24
- 작성: 브레인스토밍 세션 (Claude Code)
- 연관 이슈: [#20](https://github.com/curea-co/pullim-admissions-coach/issues/20) (P1), 후속: [#19](https://github.com/curea-co/pullim-admissions-coach/issues/19)(3역량 전환 — 본 작업은 그 위에 스택)
- 상태: 설계 확정 대기

---

## 1. 배경 / 문제

출력③ '부족 활동 보완안'이 **2024학년도 대입부터 평가에 반영되지 않는 항목**을 추천한다(대표: "관심 분야 독서 1~2권 추가"). 미반영 항목으로 학생을 유도하는 역효과이며, 교사가 보면 "스펙 만들기"로 읽힌다. 가드레일(§6.1)은 "교사 기재 개입"만 막고 **학생 활동 패딩 유도**는 막지 못한다.

### 입시 근거 (조사 확정, #19에서 검증)
- **2024학년도 대입부터 미반영:** 자율동아리, 개인 봉사활동 실적, 독서활동(도서명·저자 포함 미반영), 영재·발명교육 실적, 수상경력.
- 자기소개서 폐지(2024) → 평가 자료는 학생부 + 면접. **세특·교과 연계·정규 창체**의 비중 급상승.

출처:
- 2024 학생부 반영 방식 변화: http://www.edujin.co.kr/news/articleView.html?idxno=42055
- 자소서 폐지·세특 영향력 강화: https://news.unn.net/news/articleView.html?idxno=540606
- 세특 중요성: https://www.top-tier.co.kr/notice/getNoticeDetail.hs?noticeSeq=586&type=BT03

## 2. 목표 / 비목표

**목표**
- 보완 제안 로직을 **현행 반영 항목**(세특 탐구·교과–진로 연계·정규 창체 깊이·자기주도 학습 정리) 중심으로 재설계.
- 미반영 항목 **신설 추천**을 차단(가드 + 회귀 NG). 단 **근거 인용**은 허용.
- "적합도 차이 → 갭 메우기"(스펙 채우기) 프레이밍을 **"이미 가진 경험을 학종 평가요소로 더 또렷이 드러내기"**로 전환.

**비목표 (YAGNI)**
- 진단②(#19)·면접① 산출물 — 불변.
- "부족 활동 보완안" 명칭 변경 — §4-3 확정 명칭 유지(내용/톤만 전환).
- Phase D 서버 guardrail-scanner 구현 — 본 작업의 shared 헬퍼를 재사용하게만 둠.
- 입력 스키마 — 무관.

## 3. 결정 사항 (브레인스토밍 확정)

| # | 결정 | 선택 |
|---|---|---|
| 재설계 범위 | 전체(로직 + 가드 + 프레이밍 전환) | 확정 |
| Enforcement | docs-level(prompt NG + golden) + **테스트되는 shared 헬퍼**(추천 vs 인용 구분) | 확정 |
| 브랜치 | `feat/19-diagnosis-competency-model` 위에 스택(`feat/20-...`) | 확정 |

## 4. 반영 / 미반영 분류 (재설계 기준)

| 구분 | 항목 | 보완 제안 |
|---|---|---|
| **반영(추천 가능)** | 교과 세특으로 드러낼 탐구·심화, 교과–진로 연계, 정규 창의적 체험활동(정식 동아리·자율활동·진로활동) 깊이, 자기주도 학습 과정 정리 | 권장 |
| **미반영(2024~, 신설 추천 금지)** | 독서활동 · **자율동아리**(정규 동아리는 반영) · 수상경력 · 개인 봉사활동 실적 · 영재·발명교육 | **신설 추천 금지** (근거 인용은 허용) |

> 핵심 구분: 금지 대상은 *미반영 항목을 새로 하라는 추천*이다. *기존 기록을 근거(evidence)로 인용*하는 것은 허용한다(예: "독서활동에서 보인 관심을 세특 탐구로 연결"은 허용; "독서 1~2권을 추가하라"는 금지).

## 5. 프레이밍 전환

- `fit_delta`: 지원 학부 대비 관찰은 짧게 유지하되, "갭/부족 → 채워라" 톤을 제거하고 "강점을 학종 평가요소로 어떻게 드러낼지"로 전환.
- result UI ImprovementsPanel·키워드·제목 카피: 스펙-제조 어휘 제거, 주어=학생 본인·시점=앞으로 유지.
- definition §4-3 카피: 동일 톤으로 1줄 보정.

## 6. Enforcement

### 6.1 shared 헬퍼 (신규, 테스트)
`packages/shared/src/guardrails/unreflected-activities.ts`:
```
UNREFLECTED_ACTIVITY_TERMS: string[]   // 독서/독서활동, 자율동아리, 수상/대회 수상, (개인) 봉사활동 실적, 영재, 발명
RECOMMENDATION_VERB_RE: RegExp         // 추가|더 읽|읽어|신설|만들|참가|참여해|해보|준비
UNREFLECTED_RECOMMENDATION_RE: RegExp  // 위 둘을 근접 결합한 문맥 앵커 정규식
flagsUnreflectedRecommendation(text: string): boolean
```
- 양성(검출): "관심 분야 독서 1~2권 추가", "자율동아리를 만들어", "교내 대회 수상 준비", "봉사활동 실적을 더 쌓아".
- 음성(미검출): "독서활동을 근거로 세특 탐구와 연결", "정규 동아리 활동의 깊이를 정리", "수상 경력에서 보인 관심"(인용), 추천 동사 부재.
- 자율동아리만 잡고 *정규/정식 동아리*는 잡지 않도록 `자율\s*동아리` 한정.

### 6.2 prompt (`docs/prompt_v0.1.md`)
- improvements 규칙 신설: 보완 제안 = 반영 항목 중심, 미반영 항목 신설 추천 금지(근거 인용 허용), 주어=학생 본인·시점=앞으로(§6.1 유지).
- §4.7 NG 정규식: 6.1의 `UNREFLECTED_RECOMMENDATION_RE`와 **동일 소스**(문서에 명시). 매치 시 회귀 실패.
- 자기검토 체크리스트에 1줄 추가: "보완 제안에 미반영 항목 신설 추천 0건."

### 6.3 golden 5건
- 출력③ suggestions를 반영-항목으로 재작성(특히 case-01의 '독서 1~2권 추가' 교체).
- 각 케이스 NG 셋에 "미반영 항목(독서·자율동아리·수상·개인봉사·영재발명) 신설 추천 → NG" 추가.

## 7. Cascade / 영향 파일
- 신규: `packages/shared/src/guardrails/unreflected-activities.ts`, `...unreflected-activities.test.ts`, `packages/shared/src/index.ts`(barrel)
- 수정: `apps/web/lib/mock/park-junho.ts`(improvements.suggestions·fitDelta·keywords), `apps/web/app/result/page.tsx`(ImprovementsPanel 카피)
- 수정(SSOT, **EPO 검수**): `docs/prompt_v0.1.md`, `docs/golden/case-01~05`, `docs/golden/README.md`, `docs/002_..._definition_v.3.md` §4-3

## 8. 테스트
- shared 단위테스트: `flagsUnreflectedRecommendation` 양성/음성(특히 추천 vs 근거 인용 구분, 자율동아리 vs 정규 동아리).
- golden NG 게이트: 각 출력③에 `flagsUnreflectedRecommendation` 0건(회귀). 박준호 mock improvements도 0건.

## 9. 리스크 / 하위호환
- 추천 vs 인용 구분은 문맥 앵커라 경계 케이스 존재(예: "독서로 키운 관심을 살려 ~ 활동을 해보라"). 보수적으로: 미반영 항목 토큰이 추천 동사와 근접하면 NG, 인용 맥락(근거/에서 보인/을 ~로 연결)이면 통과. 테스트로 핵심 케이스 고정.
- SSOT(definition·prompt·golden)는 EPO(최선혜) 소유 → 승인 전 머지 금지.
- `feat/19` 스택: #19 머지 후에야 #20 머지 가능(순차).
- 입력 스키마·기존 흐름 불변.
