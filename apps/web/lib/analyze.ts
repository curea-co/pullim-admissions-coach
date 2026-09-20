// 진단 결과 계약(AnalyzeResult) — **타입 전용 모듈이다.**
//
// 실행은 ADR-058 로 pullim-api(`src/admissions/engine/`)로 이전했다. 이 파일에 있던
// `analyze()` 오케스트레이션과 `lib/ai/{diagnose,interview,prescribe,twin-judge}` 호출
// 계층은 **도달 불가 코드**였다 — `/api/analyze` 라우트가 없어 자기 테스트에서만 호출됐다.
//
// 그런데도 백엔드를 미러링하는 모양이라 유지 비용은 그대로였고, 실제로 어긋났다:
// 프롬프트가 확장 스키마를 반영하지 않고, 처방이 아직 생성되지 않은 면접 질문 번호를
// 인용하게 시키고, 면접 유형 KB 를 주입하지 않는 상태가 남아 있었다(2026-09-18 코드리뷰).
// 두 번째 사본을 계속 맞추는 대신 삭제했다. **출력 계약(타입)은 여기 남는다** —
// `admissions-api`·`result-view`·`twin`·`fit` 이 이 타입을 쓴다.
// 벤더 스키마 미러는 `lib/ai/schemas.ts`(백엔드 SSOT 사본)가 계속 담당한다.

import type { CohortResult, Rubric, TwinDiff, Roadmap } from '@pullim/engine'
import type { FitAssessment } from './fit'
import type { Diagnosis, InterviewPack } from './ai/schemas'

export interface AnalyzeResult {
  cohort: CohortResult
  diagnosis: Diagnosis
  rubric: Rubric
  /** 종단 트윈(선택) — priorSaengbu가 있을 때만 채워진다(결정론적 baseline + LLM judge 병합). */
  twin?: TwinDiff
  /** 입시 로드맵(결정론) — cohort+학년 기반 학종 타임라인. */
  roadmap?: Roadmap
  /** 정성 적합도(결정론, no LLM) — 합격%·점수 없음. */
  fit?: FitAssessment
  /** 면접 준비 팩(1 LLM call) — 답변 방향만, 근거 인용 기반. */
  interview?: InterviewPack
}
