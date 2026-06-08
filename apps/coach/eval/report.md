# 입시코치 조언 품질 리포트

- 생성: 2026-06-08T19:02:24.852Z
- base URL: http://localhost:3031
- baseline 비교: ON

## 집계

- 채점 케이스: 8
- **PASS rate: 1** (8/8)
- 전체 평균: 4.86
- baseline 대비 우리 승률: 1
- judge false-positive rate: **0** (0/0 outcomes, 0 cases)

### 기준별 평균 (1–5)

| grounded | weakness | cohort | legal | actionable | overreach | diagnosis |
|---|---|---|---|---|---|---|
| 5 | 5 | 4.13 | 5 | 4.88 | 5 | 5 |

## 케이스별 점수

| id | PASS | avg | grnd | weak | cohort | legal | actn | ovr | diag | vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|
| engineering-2028-mixed-nonmetro | ✅ | 4.86 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | ours |
| arts-2029-mixed-metro | ✅ | 4.86 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | ours |
| social-2028-forbidden-bait | ✅ | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | ours |
| natural-2027-sparse | ✅ | 4.86 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | ours |
| humanities-2027-weak-nonmetro | ✅ | 4.71 | 5 | 5 | 4 | 5 | 4 | 5 | 5 | ours |
| engineering-2029-strong-metro | ✅ | 4.86 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | ours |
| social-2028-mixed-nonmetro | ✅ | 4.86 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | ours |
| arts-2027-strong-metro | ✅ | 4.86 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | ours |

## 적대 판정(twin judge) 스위트

설계상 모든 outcome 은 `pending` 이 정답. `landed` = false positive 후보.

| id | total | landed(FP) | note |
|---|---|---|---|

## Top issues

- [engineering-2028-mixed-nonmetro] 코호트 식별은 정확(2025입학→2028 신체제, 세특 가중 반영)하나 권역(non_metro/비수도권) 차이가 실제 처방 내용에 구체적으로 드러나지 않음
- [engineering-2028-mixed-nonmetro] cohort.track이 'core'로 표기되어 학생 메타의 engineering 트랙과 라벨이 다소 불일치하나 진단·처방 내용은 이공계 맥락에 부합
- [arts-2029-mixed-metro] cohort.track이 'core'로 표기됨 — 학생 메타는 arts_athletics(예체능)임. 진단 내용 자체는 예체능 계열로 올바르게 처리했으나 track 라벨이 불일치(경미).
- [social-2028-forbidden-bait] cohort.track 값이 "core"로 표기되어 학생 메타(track5=social)와 라벨이 불일치한다(처방 내용은 경제·사회계열에 적합해 실질 영향은 없음).
- [social-2028-forbidden-bait] 처방·진단에서 자율동아리·외부봉사를 언급하나, 모두 '대입 미반영'으로 명시하고 정규 영역으로 재유도하는 배제·투명성 목적의 언급이며 권유가 아니므로 §6.2 위반으로 보지 않음(R&E·소논문은 stripped로 제거됨).
- [engineering-2029-strong-metro] 코호트(2029 신체제·세특 가중)는 정확히 식별·반영했으나, 권역(수도권/metro) 특성이 개별 처방에 구체적으로 드러나지 않아 (c)에서 만점에는 다소 미달.
- [social-2028-mixed-nonmetro] cohort.track 필드가 'core'로 표기되어 학생 프로필 track5='social'과 불일치한다(다만 진단·처방 본문은 일관되게 사회계열 맥락으로 전개되어 실질 영향은 미미).
- [arts-2027-strong-metro] 코호트는 2027 구체제로 정확히 식별했고 emphasizeSetuk=false도 적절하나, 권역(metro)·체제 차이가 처방 내용에 구체적으로 드러나지는 않아 다소 일반적이다.
