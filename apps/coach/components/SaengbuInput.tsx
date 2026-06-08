'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { extractPdfText, validatePdfFile, type PdfExtractHandle } from '@/lib/pdf'
import { IconUpload, IconCheck } from './icons'

type PdfStatus =
  | { state: 'idle' }
  | { state: 'parsing'; current: number; total: number; fileName: string }
  | { state: 'done'; fileName: string; pages: number; sizeBytes: number }
  | { state: 'error'; message: string }

/**
 * 생기부 입력 — PDF 드래그&드롭/클릭 업로드 + 텍스트 붙여넣기.
 * PDF는 클라이언트에서 pdfjs로 텍스트만 추출해 textarea를 채운다(서버 업로드 없음·프라이버시).
 * 마스킹은 기존대로 서버에서 수행하므로, 업로드는 입력 편의일 뿐 동작/계약은 불변.
 * 이번 학기 생기부와 이전 학기 생기부 양쪽에 동일하게 재사용해 DRY 유지.
 */
export function SaengbuInput({
  id,
  value,
  onChange,
  height = 200,
  placeholder,
  textareaRef,
  ariaInvalid,
  ariaDescribedby,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  height?: number
  placeholder?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  ariaInvalid?: boolean
  ariaDescribedby?: string
}) {
  const [status, setStatus] = useState<PdfStatus>({ state: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // race guard: 가장 최근 요청만 반영. 진행 중 핸들은 새 파일/clear 시 실제 중단.
  const reqIdRef = useRef(0)
  const handleRef = useRef<PdfExtractHandle | null>(null)
  const hintId = useId()
  const statusId = useId()

  // unmount cleanup: 파싱 중 화면 이탈 시 워커가 계속 도는 것을 막는다.
  useEffect(() => {
    return () => {
      handleRef.current?.cancel()
      handleRef.current = null
    }
  }, [])

  async function handleFile(file: File) {
    // 검증 이전에 이전 작업 무효화 — invalid 재선택에서도 stale done이 덮어쓰지 못하게.
    handleRef.current?.cancel()
    const reqId = ++reqIdRef.current

    const v = validatePdfFile(file)
    if (!v.ok) {
      setStatus({ state: 'error', message: v.error })
      return
    }

    setStatus({ state: 'parsing', current: 0, total: 0, fileName: file.name })
    const handle = extractPdfText(file, (p) => {
      if (reqId !== reqIdRef.current) return
      setStatus({ state: 'parsing', current: p.current, total: p.total, fileName: file.name })
    })
    handleRef.current = handle
    const result = await handle.promise
    if (reqId !== reqIdRef.current) return
    if (result.ok === false && result.code === 'cancelled') return

    if (!result.ok) {
      setStatus({ state: 'error', message: result.error })
      return
    }
    setStatus({ state: 'done', fileName: file.name, pages: result.pages, sizeBytes: result.sizeBytes })
    onChange(result.text) // textarea를 추출 본문으로 채운다(이후 직접 수정 가능).
  }

  function clearFile() {
    handleRef.current?.cancel()
    handleRef.current = null
    reqIdRef.current++
    setStatus({ state: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
    // textarea 본문은 지우지 않는다 — 붙여넣기/직접 편집 내용을 보존.
  }

  const pick = () => fileInputRef.current?.click()

  return (
    <div>
      {/* 드롭존 — 실제 file input + label로 키보드 접근 가능 */}
      <input
        ref={fileInputRef}
        id={`${id}-file`}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-describedby={hintId}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />

      {status.state === 'done' ? (
        <div
          className="mb-2 flex flex-wrap items-center justify-between gap-2 px-[14px] py-[10px]"
          style={{
            border: '1.5px solid var(--ok)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--ok-bg)',
            fontSize: 'var(--fs-sm)',
          }}
        >
          <span className="inline-flex min-w-0 items-center gap-2" style={{ color: 'var(--ok)', fontWeight: 700 }}>
            <IconCheck size={14} />
            <span className="truncate">{status.fileName}</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 500, color: 'var(--fg-muted)' }}>
              {status.pages}p · {(status.sizeBytes / 1024 / 1024).toFixed(1)}MB · {value.length.toLocaleString()}자
            </span>
          </span>
          <button
            type="button"
            onClick={clearFile}
            className="flex-none px-2 py-1"
            style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--r-sm)', background: '#fff', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--fg-muted)', cursor: 'pointer' }}
          >
            제거
          </button>
        </div>
      ) : status.state === 'parsing' ? (
        <div
          className="mb-2 px-[14px] py-3"
          style={{ border: '1.5px solid var(--pullim-blue)', borderRadius: 'var(--r-sm)', background: 'var(--pb-1)', fontSize: 'var(--fs-sm)' }}
        >
          <span className="inline-flex items-center gap-2" style={{ color: 'var(--pullim-blue)', fontWeight: 700 }}>
            <span className="spinner" aria-hidden style={{ borderColor: 'rgba(3,98,218,.25)', borderTopColor: 'var(--pullim-blue)' }} />
            <span className="truncate">{status.fileName}</span> 텍스트 추출 중…
          </span>
          <span className="ml-2" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
            {status.total > 0 ? `${status.current}/${status.total}p` : '읽는 중'}
          </span>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-describedby={hintId}
          onClick={pick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              pick()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          className="mb-2 flex cursor-pointer items-center gap-3 px-[14px] py-3 text-left"
          style={{
            border: `1.5px dashed ${dragOver ? 'var(--pullim-blue)' : status.state === 'error' ? 'var(--bad)' : 'var(--hairline)'}`,
            borderRadius: 'var(--r-sm)',
            background: dragOver ? 'var(--pb-1)' : status.state === 'error' ? 'var(--bad-bg)' : 'var(--bg)',
            transition: 'border-color .15s ease, background .15s ease',
          }}
        >
          <span className="sg soft flex-none">
            <IconUpload size={16} />
          </span>
          <span className="min-w-0">
            {status.state === 'error' ? (
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--bad)' }}>{status.message}</span>
            ) : (
              <>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--pullim-ink2)' }}>
                  PDF 끌어다 놓기 또는 클릭해서 선택
                </span>
                <span className="block" style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)' }}>
                  생기부 PDF의 텍스트만 추출해 아래에 채웁니다 · 파일은 서버로 전송하지 않아요
                </span>
              </>
            )}
          </span>
        </div>
      )}

      <p id={hintId} className="sr-only">
        PDF 파일을 끌어다 놓거나 클릭해 선택하면 텍스트가 자동으로 아래 입력란에 채워집니다. 최대 10 MB, 텍스트 기반 PDF만
        지원하며 스캔본은 직접 붙여넣어 주세요. 파일은 서버로 전송되지 않습니다.
      </p>

      {/* a11y: 추출 상태를 보조기기에 안내 */}
      <p id={statusId} aria-live="polite" className="sr-only">
        {status.state === 'parsing'
          ? `${status.fileName} 텍스트 추출 중`
          : status.state === 'done'
            ? `${status.fileName} 추출 완료, ${value.length}자`
            : status.state === 'error'
              ? status.message
              : ''}
      </p>

      <textarea
        id={id}
        ref={textareaRef}
        className="control"
        style={{ height, fontSize: 13, fontFamily: 'var(--f-mono)' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={[ariaDescribedby, hintId, statusId].filter(Boolean).join(' ') || undefined}
        placeholder={placeholder}
      />
    </div>
  )
}
