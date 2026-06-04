// 클라이언트 PDF 텍스트 추출 helper.
// Phase A+B: 백엔드 부재 상황에서 브라우저에서 직접 pdfjs로 파싱.
// Phase D: NestJS api + S3 presigned URL 경로 추가 시 본 helper는 미리보기·검증용으로 유지.

// 'use client' 부착된 컴포넌트에서만 호출. SSR 환경에서는 호출 금지.

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
        | 'parse_failed'
        | 'encrypted'
        | 'empty'
        | 'unknown';
    };

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PAGES = 50; // 안전 상한

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

export async function extractPdfText(
  file: File,
  onProgress?: (p: PdfExtractProgress) => void
): Promise<PdfExtractResult> {
  const v = validatePdfFile(file);
  if (!v.ok) return { ...v, ok: false };

  try {
    // dynamic import: pdfjs는 ~1MB, SSR 회피, 초기 번들 비대화 회피
    const pdfjs = await import('pdfjs-dist');

    // Worker 설정: jsdelivr CDN (버전 자동 매칭). CSP 헤더 도입 시 self-host로 전환.
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const numPages = Math.min(pdf.numPages, MAX_PAGES);
    if (numPages === 0) {
      return { ok: false, error: 'PDF에 페이지가 없습니다.', code: 'empty' };
    }

    let fullText = '';
    for (let i = 1; i <= numPages; i++) {
      onProgress?.({ current: i, total: numPages });
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
  }
}
