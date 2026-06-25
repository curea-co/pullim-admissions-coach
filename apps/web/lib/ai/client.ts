import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic() // ANTHROPIC_API_KEY from env
export const MODEL = 'claude-opus-4-8'
