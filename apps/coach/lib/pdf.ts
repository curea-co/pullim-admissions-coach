// 클라이언트 PDF 텍스트 추출 helper (입시코치).
// 프라이버시: 생기부 PDF는 서버로 업로드하지 않고, 브라우저에서 pdfjs로 텍스트만 추출해
// textarea에 채운다. 마스킹은 기존대로 서버(/api/analyze)에서 수행하므로 본 helper는 입력 편의용.
// apps/web/lib/pdf.ts 패턴을 포팅 — 같은 pdfjs-dist 4.10.38 + same-origin worker.
//
// 'use client' 컴포넌트에서만 호출. SSR 환경에서는 호출 금지.

import type { PDFDocumentLoadingTask } from 'pdfjs-dist'

export type PdfExtractProgress = {
  current: number
  total: number
}

export type PdfExtractResult =
  | {
      ok: true
      text: string
      pages: number
      sizeBytes: number
    }
  | {
      ok: false
      error: string
      code:
        | 'invalid_type'
        | 'too_large'
        | 'too_many_pages'
        | 'parse_failed'
        | 'encrypted'
        | 'empty'
        | 'cancelled'
        | 'unknown'
    }

// 취소 가능한 핸들: 새 파일/clear 시 진행 중인 pdf.js 작업을 destroy()로 중단해
// 큰 PDF 연속 선택 시 CPU/메모리 이중 소비·UI 프리즈를 막는다.
export type PdfExtractHandle = {
  promise: Promise<PdfExtractResult>
  cancel: () => void
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_PAGES = 50 // 안전 상한 — 초과 시 silent truncation 대신 명시 실패

const CANCELLED: PdfExtractResult = {
  ok: false,
  error: '이전 PDF 처리가 중단되었습니다.',
  code: 'cancelled',
}

// 스캔본(이미지 PDF)·추출 불가 안내 — 스펙 카피. textarea 직접 붙여넣기로 폴백.
const EMPTY_MESSAGE =
  '텍스트를 추출할 수 없습니다(스캔본일 수 있어요). 직접 붙여넣어 주세요.'

export function validatePdfFile(
  file: File
): { ok: true } | { ok: false; error: string; code: 'invalid_type' | 'too_large' } {
  // 일부 브라우저는 MIME을 비워 보내므로 확장자 폴백.
  const isPdfMime = file.type === 'application/pdf'
  const isPdfExt = file.name.toLowerCase().endsWith('.pdf')
  if (!isPdfMime && !isPdfExt) {
    return { ok: false, error: 'PDF 파일만 업로드할 수 있어요. 텍스트는 아래에 직접 붙여넣어 주세요.', code: 'invalid_type' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return {
      ok: false,
      error: `파일이 너무 큽니다(${mb} MB). 10 MB 이하로 다시 시도해 주세요.`,
      code: 'too_large',
    }
  }
  return { ok: true }
}

export function extractPdfText(
  file: File,
  onProgress?: (p: PdfExtractProgress) => void
): PdfExtractHandle {
  let cancelled = false
  let loadingTask: PDFDocumentLoadingTask | null = null

  const promise = (async (): Promise<PdfExtractResult> => {
    const v = validatePdfFile(file)
    if (!v.ok) return { ...v, ok: false }

    try {
      // dynamic import: pdfjs는 ~1MB, SSR 회피, 초기 번들 비대화 회피.
      const pdfjs = await import('pdfjs-dist')
      if (cancelled) return CANCELLED

      // Worker는 same-origin self-host. 학교망·사내망 CDN 차단 위험 +
      // 미성년 데이터 흐름의 외부 의존 최소화. 파일: apps/coach/public/pdf.worker.min.mjs.
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      }

      const arrayBuffer = await file.arrayBuffer()
      if (cancelled) return CANCELLED

      loadingTask = pdfjs.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      if (cancelled) return CANCELLED

      if (pdf.numPages === 0) {
        return { ok: false, error: EMPTY_MESSAGE, code: 'empty' }
      }

      if (pdf.numPages > MAX_PAGES) {
        return {
          ok: false,
          error: `PDF가 ${pdf.numPages}페이지로 너무 깁니다. 최대 ${MAX_PAGES}페이지까지 지원해요. 필요한 부분만 잘라낸 PDF로 다시 시도하거나 텍스트를 직접 붙여넣어 주세요.`,
          code: 'too_many_pages',
        }
      }

      let fullText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return CANCELLED
        onProgress?.({ current: i, total: pdf.numPages })
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
        fullText += pageText + '\n\n'
      }

      const trimmed = fullText.trim()
      if (trimmed.length === 0) {
        return { ok: false, error: EMPTY_MESSAGE, code: 'empty' }
      }

      return { ok: true, text: trimmed, pages: pdf.numPages, sizeBytes: file.size }
    } catch (err) {
      if (cancelled) return CANCELLED
      const message = err instanceof Error ? err.message : String(err)
      if (message.toLowerCase().includes('password')) {
        return {
          ok: false,
          error: '비밀번호로 보호된 PDF예요. 보호를 해제한 뒤 다시 시도해 주세요.',
          code: 'encrypted',
        }
      }
      // pdfjs raw 에러 문자열은 사용자에게 노출하지 않는다(UX·정보 노출 차단).
      // 디버깅용은 console.warn으로만, 사용자에겐 일반화된 안내 + 폴백 제시.
      console.warn('[pdf] parse failed:', message)
      return {
        ok: false,
        error: 'PDF를 처리하지 못했어요. 다른 PDF로 다시 시도하거나 텍스트를 직접 붙여넣어 주세요.',
        code: 'parse_failed',
      }
    } finally {
      loadingTask = null
    }
  })()

  return {
    promise,
    cancel: () => {
      cancelled = true
      if (loadingTask) {
        loadingTask.destroy().catch(() => {})
      }
    },
  }
}
