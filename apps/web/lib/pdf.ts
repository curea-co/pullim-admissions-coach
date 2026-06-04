// 클라이언트 PDF 텍스트 추출 helper.
// Phase A+B: 백엔드 부재 상황에서 브라우저에서 직접 pdfjs로 파싱.
// Phase D: NestJS api + S3 presigned URL 경로 추가 시 본 helper는 미리보기·검증용으로 유지.

// 'use client' 부착된 컴포넌트에서만 호출. SSR 환경에서는 호출 금지.

import type { PDFDocumentLoadingTask } from 'pdfjs-dist';

export type PdfExtractProgress = {
  current: number;
  total: number;
};

export type PdfExtractResult =
  | {
      ok: true;
      text: string;
      pages: number;
      sizeBytes: number;
    }
  | {
      ok: false;
      error: string;
      code:
        | 'invalid_type'
        | 'too_large'
        | 'too_many_pages'
        | 'parse_failed'
        | 'encrypted'
        | 'empty'
        | 'cancelled'
        | 'unknown';
    };

// codex review P2 후속: 취소 가능한 핸들. 실제 pdf.js 작업을 destroy()로 중단해
// 큰 PDF 연속 선택 시 CPU/메모리 이중 소비·UI 프리즈 위험을 차단한다.
export type PdfExtractHandle = {
  promise: Promise<PdfExtractResult>;
  cancel: () => void;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PAGES = 50; // 안전 상한 — 초과 시 silent truncation 대신 명시 실패 (codex review P1)

const CANCELLED: PdfExtractResult = {
  ok: false,
  error: '이전 PDF 처리가 중단되었습니다.',
  code: 'cancelled',
};

export function validatePdfFile(file: File): { ok: true } | { ok: false; error: string; code: 'invalid_type' | 'too_large' } {
  // Type check — accept application/pdf or .pdf extension fallback (some browsers omit MIME)
  const isPdfMime = file.type === 'application/pdf';
  const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
  if (!isPdfMime && !isPdfExt) {
    return { ok: false, error: 'PDF 파일만 업로드할 수 있습니다.', code: 'invalid_type' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `파일이 너무 큽니다(${mb} MB). 10 MB 이하로 다시 시도해주세요.`,
      code: 'too_large',
    };
  }
  return { ok: true };
}

export function extractPdfText(
  file: File,
  onProgress?: (p: PdfExtractProgress) => void
): PdfExtractHandle {
  let cancelled = false;
  let loadingTask: PDFDocumentLoadingTask | null = null;

  const promise = (async (): Promise<PdfExtractResult> => {
    const v = validatePdfFile(file);
    if (!v.ok) return { ...v, ok: false };

    try {
      // dynamic import: pdfjs는 ~1MB, SSR 회피, 초기 번들 비대화 회피
      const pdfjs = await import('pdfjs-dist');
      if (cancelled) return CANCELLED;

      // Worker 설정: same-origin self-host (codex review P2).
      // 학교망·사내망 CDN 차단 위험 + 미성년자 데이터 흐름의 외부 의존 최소화.
      // 파일 위치: apps/web/public/pdf.worker.min.mjs (pdfjs-dist 4.10.38 빌드 카피).
      // package.json은 4.10.38 exact pin이라 메인 번들과 워커 버전 드리프트 차단 (codex review P1).
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }

      const arrayBuffer = await file.arrayBuffer();
      if (cancelled) return CANCELLED;

      loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      if (cancelled) return CANCELLED;

      if (pdf.numPages === 0) {
        return { ok: false, error: 'PDF에 페이지가 없습니다.', code: 'empty' };
      }

      // codex review P1: silent truncation 차단. MAX_PAGES 초과 시 명시 실패.
      if (pdf.numPages > MAX_PAGES) {
        return {
          ok: false,
          error: `PDF가 ${pdf.numPages}페이지로 너무 깁니다. 최대 ${MAX_PAGES}페이지까지 지원합니다. 필요한 부분만 잘라낸 PDF로 다시 시도하거나 텍스트 직접 붙여넣기 탭을 이용해주세요.`,
          code: 'too_many_pages',
        };
      }

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return CANCELLED;
        onProgress?.({ current: i, total: pdf.numPages });
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
        fullText += pageText + '\n\n';
      }

      const trimmed = fullText.trim();
      if (trimmed.length === 0) {
        return {
          ok: false,
          error:
            '텍스트를 추출하지 못했습니다. 이미지 기반 PDF이거나 보호된 파일일 수 있어요. 텍스트 직접 붙여넣기 탭을 사용해주세요.',
          code: 'empty',
        };
      }

      return {
        ok: true,
        text: trimmed,
        pages: pdf.numPages,
        sizeBytes: file.size,
      };
    } catch (err) {
      // destroy() 중단으로 발생한 예외는 cancel 결과로 흡수.
      if (cancelled) return CANCELLED;
      const message = err instanceof Error ? err.message : String(err);
      // 암호화 PDF는 pdfjs가 PasswordException을 던짐
      if (message.toLowerCase().includes('password')) {
        return {
          ok: false,
          error: '비밀번호로 보호된 PDF입니다. 보호를 해제한 후 다시 시도해주세요.',
          code: 'encrypted',
        };
      }
      return {
        ok: false,
        error: `PDF 파싱 실패: ${message}`,
        code: 'parse_failed',
      };
    } finally {
      loadingTask = null;
    }
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      // pdfjs loadingTask.destroy()는 워커 측 작업과 future page reads를 모두 중단한다.
      // 에러는 위 try/catch의 cancelled 가드로 흡수.
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    },
  };
}
