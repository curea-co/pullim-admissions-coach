# 입시코치 조언 품질 리포트

- 생성: 2026-06-08T18:18:27.128Z
- base URL: http://localhost:3031
- baseline 비교: ON

## 집계

- 채점 케이스: 4
- **PASS rate: 1** (4/4)
- 전체 평균: 4.93
- baseline 대비 우리 승률: 1
- judge false-positive rate: **0** (0/33 outcomes, 6 cases)

### 기준별 평균 (1–5)

| grounded | weakness | cohort | legal | actionable | overreach | diagnosis |
|---|---|---|---|---|---|---|
| 5 | 5 | 4.5 | 5 | 5 | 5 | 5 |

## 케이스별 점수

| id | PASS | avg | grnd | weak | cohort | legal | actn | ovr | diag | vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|
| humanities-2028-strong-metro | ✅ | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | ours |
| humanities-2028-strong-nonmetro | ✅ | 4.86 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | ours |
| social-2027-mixed-metro | ✅ | 4.86 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | ours |
| natural-2029-strong-metro | ✅ | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | ours |

## 적대 판정(twin judge) 스위트

설계상 모든 outcome 은 `pending` 이 정답. `landed` = false positive 후보.

| id | total | landed(FP) | note |
|---|---|---|---|
| judge-unrelated-next-term | 5 | 0 | 이전 학기 처방(경제·자료해석)과 무관한 예체능 활동만. landed 0 기대 → landed면 FP. |
| judge-distractor-keyword-overlap | 6 | 0 | ★핵심. 회귀분석·경제 키워드가 표면적으로 겹치지만 학생의 능동적 탐구 안착이 아님(수동 청취·어휘정리). landed면 false positive. |
| judge-plan-not-evidence | 5 | 0 | "하고 싶다"는 의지 표명만, 실제 오차 분석 실행 증거 없음. landed면 FP. |
| judge-same-subject-different-topic | 6 | 0 | 같은 물리학이지만 단진동·오차 처방과 무관한 전자기 단원. landed면 FP. |
| judge-sparse-next-term | 6 | 0 | 현재 생기부에 비평·토론 안착 증거가 전혀 없음(빈약). landed면 FP. |
| judge-attempted-then-abandoned | 5 | 0 | 반대논거 검토를 시도했으나 포기·대체. 실제 안착 아님. landed면 FP. |

## Top issues

- [humanities-2028-strong-nonmetro] 코호트 식별(2028 신체제·세특 가중·비수도권)은 정확하나, 권역(비수도권) 차이가 실제 처방 내용에 구체적으로 드러나지 않아 (c)에서 만점에 약간 못 미침.
- [humanities-2028-strong-nonmetro] cohort.track이 'core'로 표기되어 프로필의 humanities와 표기상 불일치(다만 처방 내용은 인문계열 맥락에 부합).
