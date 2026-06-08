# 입시코치 조언 품질 평가 하네스 (advice-quality eval)

가드레일 통과 여부가 아니라 **실제 출력(진단 + 처방 + 트윈 판정)이 좋은가**를 측정한다.
이것이 제품의 #1 미증명 리스크다.

## 구조 (HTTP 기반인 이유)

앱 파이프라인(`lib/analyze.ts`, `lib/ai/*`)은 `'server-only'` 를 import 하므로
일반 Node 스크립트로 직접 import 할 수 없다. 따라서 이 하네스는 **HTTP 기반**이다:
실행 중인 dev 서버 `http://localhost:3031/api/analyze` 에 픽스처를 POST 하고 JSON 응답을 채점한다.
grader/baseline 은 **자체 standalone `new Anthropic()`** 을 쓴다(`server-only` 미포함).
모든 파일은 `.mjs` ES 모듈(Node 20+, native fetch). 앱 모듈은 절대 import 하지 않는다.

## 파일

| 파일 | 역할 |
|---|---|
| `rubric.md` | 7개 품질 기준(1–5) + overall PASS bar |
| `fixtures.mjs` | 12개 현실적 요청 바디 (5계열·3코호트·강/약/혼합·forbidden-bait·sparse·권역쌍) |
| `grader.mjs` | standalone LLM 채점기 (opus-4-8, 구조화 출력). 생기부 원문 대조로 환각 검사 |
| `baseline.mjs` | 나이브 자유텍스트 조언 + 우리 처방과의 사이드바이사이드 비교 |
| `adversarial-judge.mjs` | 트윈 판정기 false-positive 적대 6케이스(distractor 포함) |
| `run.mjs` | 오케스트레이터 — POST → 채점 → 비교 → 판정 → report.md/json |

## 실행

이 평가는 **실제 API 호출 비용**이 발생한다.

### 1. dev 서버를 키와 함께 띄운다 (별도 터미널)

```bash
ANTHROPIC_API_KEY=sk-... pnpm --filter @pullim/coach dev
# → http://localhost:3031
```

### 2. 평가 실행 (또 다른 터미널)

```bash
# grader/baseline 용 키 필요
ANTHROPIC_API_KEY=sk-... node apps/coach/eval/run.mjs
```

옵션 (환경변수):

```bash
# 픽스처 4개만
ANTHROPIC_API_KEY=sk-... EVAL_LIMIT=4 node apps/coach/eval/run.mjs

# 나이브 베이스라인 비교까지 (비용↑)
ANTHROPIC_API_KEY=sk-... EVAL_BASELINE=1 node apps/coach/eval/run.mjs

# 다른 포트/호스트
ANTHROPIC_API_KEY=sk-... EVAL_BASE_URL=http://localhost:4000 node apps/coach/eval/run.mjs
```

### 산출물

- `apps/coach/eval/report.md` — 케이스별 점수표, 기준별 평균, PASS rate, baseline 승률, judge FP rate, top issues
- `apps/coach/eval/report.json` — 동일 데이터의 구조화 버전
- stdout 요약

## 견고성

- dev 서버 미기동 → 연결 실패 시 크래시 대신 명확한 안내 메시지로 종료
- `ANTHROPIC_API_KEY` 없음 → 명확한 메시지로 종료
- analyze 503(혼잡) → 지수 백오프 재시도(최대 4회)
- analyze non-200 / twin 누락 / grader 오류 → 해당 케이스만 SKIP, 나머지는 계속

## 주의

- 이 디렉터리는 **툴링**이다. Next 빌드/타입체크/테스트 대상이 아니다(`.mjs` 라 tsc 무시 + tsconfig exclude).
- 앱 코드(lib/api/packages/web/docs)는 수정하지 않는다.
