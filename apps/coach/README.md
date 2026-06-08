# @pullim/coach — 입시코치 (폐쇄루프, 수직 슬라이스)

기존 `apps/web`(read-only 진단기)와 별개의 새 구현. 진단→처방→증명 폐쇄루프 + 코호트 분기 + §6.2 합법성 게이트 + 증거인용/무학습.

## 개발
1. `cp .env.local.example .env.local` 후 `ANTHROPIC_API_KEY` 입력
2. 루트에서 `pnpm dev:coach` → http://localhost:3031/intake

## 구조
- 해자(결정적): `packages/engine` — 코호트·합법성 게이트·루브릭·골든회귀
- LLM 어댑터: `apps/coach/lib/ai` (claude-opus-4-8, structured output, 캐싱)
- 파이프라인: `apps/coach/lib/analyze.ts`, 라우트 `app/api/analyze`
- 가드레일: 처방은 세특·정규창체·행특만(§6.2). 결과 미영속(무학습/즉시삭제).

## SDK 주석
`@anthropic-ai/sdk ^0.102.0`을 사용한다(GA `messages.parse` + `@anthropic-ai/sdk/helpers/zod`의 `zodOutputFormat` + `output_config:{effort,format}` + adaptive thinking 노출). 0.70.x에는 이 GA 표면이 없어 상향했다. SDK의 스키마 헬퍼가 `zod/v4`를 사용하므로 coach 워크스페이스는 zod 4를 쓴다(엔진·shared는 zod 3 유지). 테스트는 어댑터를 목킹하므로 네트워크·키 없이 그린.
