import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic() // ANTHROPIC_API_KEY from env
// 진단 모델 — pullim-api `src/admissions/engine/models.ts` 의 SSOT 와 같은 값을 유지한다.
// Haiku 4.5 는 adaptive thinking·output_config.effort 를 거부하므로(400) 호출부에서 둘 다 보내지 않는다.
export const MODEL = 'claude-haiku-4-5'
