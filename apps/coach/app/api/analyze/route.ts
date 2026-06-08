import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyze } from '@/lib/analyze'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: '잘못된 요청 형식' }, { status: 400 }) }
  try {
    const result = await analyze(body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 529 || err.status === 429 ? 503 : 502
      return NextResponse.json({ error: 'AI 서비스가 혼잡합니다. 잠시 후 다시 시도해 주세요.' }, { status })
    }
    const msg = err instanceof Error ? err.message : '분석 실패'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
