'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SCHEMA_VERSION,
  studentProfileSchema,
  targetTrackLabel,
  schoolTypeLabel,
  type TargetTrack,
  type SchoolType,
} from '@pullim/shared';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { GuardrailLabel } from '@/components/guardrail-label';
import { ErrorState } from '@/components/error-state';
import { validate, type FieldErrors } from '@/lib/validation';
import { extractPdfText, validatePdfFile, type PdfExtractHandle } from '@/lib/pdf';
import { parkJunho } from '@/lib/mock/park-junho';
import { cn } from '@/lib/utils';

type InputType = 'pdf_upload' | 'text_paste';

type PdfStatus =
  | { state: 'idle' }
  | { state: 'parsing'; current: number; total: number; fileName: string }
  | { state: 'done'; fileName: string; pages: number; sizeBytes: number }
  | { state: 'error'; message: string };

const tracks: { value: TargetTrack; label: string }[] = (
  Object.entries(targetTrackLabel) as [TargetTrack, string][]
).map(([value, label]) => ({ value, label }));

const schoolTypes: { value: SchoolType; label: string }[] = (
  Object.entries(schoolTypeLabel) as [SchoolType, string][]
).map(([value, label]) => ({ value, label }));

const maskedFieldOptions = [
  { id: 'student_name', label: '학생 이름' },
  { id: 'school_name', label: '학교명' },
  { id: 'birth_date', label: '생년월일' },
  { id: 'phone', label: '전화·주소' },
  { id: 'teacher_name', label: '교사명' },
] as const;

export default function SubmitPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 폼 상태 — 박준호 mock으로 초기화 (Phase A 시연 흐름 유지)
  const [inputType, setInputType] = useState<InputType>('text_paste');
  const [recordText, setRecordText] = useState('');
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>({ state: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // codex review P1: race guard. 가장 최근 요청 id만 반영. 이전 요청은 stale로 무시.
  const pdfRequestIdRef = useRef(0);
  // codex review P2 후속: 진행 중 핸들. 새 파일/clear 시 cancel()로 *실제* pdf.js 작업 중단.
  const currentPdfHandleRef = useRef<PdfExtractHandle | null>(null);

  // codex review PR #15 2차: unmount cleanup. PDF 파싱 중 학생이 뒤로가기·다른 화면으로
  // 이동해 SubmitPage가 내려가면 clearPdf()가 호출되지 않아 워커가 계속 돈다. 빈 deps라
  // mount/unmount 한 번씩만 실행되고, 본문은 unmount 시점에 진행 중인 작업을 중단.
  useEffect(() => {
    return () => {
      currentPdfHandleRef.current?.cancel();
      currentPdfHandleRef.current = null;
    };
  }, []);
  const [maskingApplied, setMaskingApplied] = useState(false);
  const [maskedFields, setMaskedFields] = useState<string[]>([]);

  const [targetTrack, setTargetTrack] = useState<TargetTrack>(
    parkJunho.profile.targetTrack
  );
  const [universities, setUniversities] = useState<
    { name: string; department?: string }[]
  >(parkJunho.profile.targetUniversities.map((u) => ({ ...u })));
  const [grade, setGrade] = useState<number>(parkJunho.identity.grade);
  const [semester, setSemester] = useState<1 | 2>(
    parkJunho.identity.semester as 1 | 2
  );
  const [schoolType, setSchoolType] = useState<SchoolType>(
    parkJunho.identity.schoolType
  );
  const [weakAreas, setWeakAreas] = useState<string>('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function toggleMaskedField(id: string) {
    setMaskedFields((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handlePdfFile(file: File) {
    // Phase A+B: 클라이언트 측 PDF → 텍스트 추출.
    // 백엔드 부재 상황에서 파일 자체를 서버로 보내지 않고 텍스트만 폼에 채운다.
    // Phase D에서 S3 presigned URL 업로드 경로가 추가되면 본 함수는 *프리뷰*용으로 유지.

    // codex review PR #15 round 3 후속: 검증 *이전*에 이전 작업을 무효화한다.
    // invalid file 재선택 분기에서도 이전 파싱이 계속 살아남아 stale done 으로 덮어쓰는
    // 정합성 문제 차단. cancel + reqId 증가를 가장 먼저 실행.
    currentPdfHandleRef.current?.cancel();
    const reqId = ++pdfRequestIdRef.current;

    const v = validatePdfFile(file);
    if (!v.ok) {
      setPdfStatus({ state: 'error', message: v.error });
      return;
    }

    setPdfStatus({
      state: 'parsing',
      current: 0,
      total: 0,
      fileName: file.name,
    });
    const handle = extractPdfText(file, (p) => {
      if (reqId !== pdfRequestIdRef.current) return; // stale progress 무시
      setPdfStatus({
        state: 'parsing',
        current: p.current,
        total: p.total,
        fileName: file.name,
      });
    });
    currentPdfHandleRef.current = handle;
    const result = await handle.promise;
    // 본 호출 도중 cancel/clear 발생 시 silent skip (stale 덮어쓰기 방지)
    if (reqId !== pdfRequestIdRef.current) return;
    if (result.ok === false && result.code === 'cancelled') return;

    if (!result.ok) {
      setPdfStatus({ state: 'error', message: result.error });
      return;
    }
    setPdfStatus({
      state: 'done',
      fileName: file.name,
      pages: result.pages,
      sizeBytes: result.sizeBytes,
    });
    setRecordText(result.text);
  }

  function clearPdf() {
    // codex review P2 후속: 진행 중 파싱을 실제 중단 + stale 가드 동시 적용.
    currentPdfHandleRef.current?.cancel();
    currentPdfHandleRef.current = null;
    pdfRequestIdRef.current++;
    setPdfStatus({ state: 'idle' });
    setRecordText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function buildPayload() {
    // Phase A+B: PDF든 텍스트든 최종 제출은 항상 text_paste.
    // PDF 탭은 *입력 방법*이고, 추출된 텍스트가 recordText에 들어가 있다.
    // Phase D에서 백엔드 S3 업로드 도착 시 pdf_upload 변환 경로 추가.
    const recordPart = {
      inputType: 'text_paste' as const,
      text: recordText,
      maskingApplied,
      maskedFields,
    };

    return {
      schemaVersion: SCHEMA_VERSION,
      record: recordPart,
      targetTrack,
      targetUniversities: universities.filter((u) => u.name.trim().length > 0),
      currentStanding: { grade, semester, schoolType },
      selfReportedWeakAreas: weakAreas || undefined,
      // /submit 단계에서는 *식별* 부분만 검증; consent는 다음 화면에서 추가됨.
      // 여기서는 schema 통과를 위해 stub consent를 만들고 /consent에서 다시 받는다.
      consent: {
        isMinor: true,
        termsAgreed: true,
        privacyPolicyAgreed: true,
        guardianConsentObtained: true,
        consentTimestamp: new Date().toISOString(),
      },
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const result = validate(studentProfileSchema, buildPayload());
    if (!result.ok) {
      setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      setSubmitError(
        `${Object.keys(result.errors).length}개 항목을 확인해주세요.${
          first ? ` (예: ${first})` : ''
        }`
      );
      // 첫 에러 필드로 포커스 이동
      const node = document.querySelector(
        `[data-field-error="${CSS.escape(first)}"]`
      ) as HTMLElement | null;
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrors({});
    // Phase B: 다음 단계(/consent)로 이동. 실 저장은 Phase C에서 NestJS api에.
    startTransition(() => {
      router.push('/consent');
    });
  }

  return (
    <>
      <PageHeader />
      <main className="w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            생기부 제출
          </h1>
          <StepIndicator current="submit" />
        </div>
        <p className="mb-6 text-ink-700">
          학생부 종합 전형 평가 기준 5항목으로 진단하기 위해 5가지 정보를 받습니다.
          개인 식별정보는 입력 단계에서 가려주세요.
        </p>

        <GuardrailLabel variant="general" className="mb-6" />

        <form className="space-y-8" noValidate onSubmit={handleSubmit}>
          {/* 1. 생기부 입력 */}
          <Field
            label="1. 생기부 파일 또는 텍스트"
            required
            help="개인 식별정보(이름·학교명·생년월일·전화·주소·교사명)를 가린 상태로 업로드하거나 붙여넣어 주세요."
          >
            <div className="mb-3 flex gap-2 rounded-xl bg-ink-100/60 p-1 text-sm">
              <TabButton
                active={inputType === 'text_paste'}
                onClick={() => setInputType('text_paste')}
              >
                텍스트 붙여넣기
              </TabButton>
              <TabButton
                active={inputType === 'pdf_upload'}
                onClick={() => setInputType('pdf_upload')}
              >
                PDF 업로드
              </TabButton>
            </div>

            {inputType === 'text_paste' ? (
              <textarea
                rows={6}
                value={recordText}
                onChange={(e) => setRecordText(e.target.value)}
                placeholder="여기에 마스킹된 생기부 본문을 붙여넣어주세요"
                className="w-full rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                aria-invalid={!!errors['record.text']}
                data-field-error="record.text"
              />
            ) : (
              <PdfUploader
                status={pdfStatus}
                onFile={handlePdfFile}
                onClear={clearPdf}
                inputRef={fileInputRef}
                extractedText={recordText}
                onExtractedTextChange={setRecordText}
              />
            )}
            <FieldError msg={errors['record.text']} />

            <MaskingChecklist
              checked={maskingApplied}
              onCheckedChange={setMaskingApplied}
              selected={maskedFields}
              onToggle={toggleMaskedField}
              errorMsg={errors['record.maskingApplied']}
            />
          </Field>

          {/* 2. 지원 학부 */}
          <Field label="2. 지원 학부 (택 1)" required>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              data-field-error="targetTrack"
            >
              {tracks.map((t) => (
                <RadioCard
                  key={t.value}
                  name="targetTrack"
                  value={t.value}
                  label={t.label}
                  checked={targetTrack === t.value}
                  onChange={() => setTargetTrack(t.value)}
                />
              ))}
            </div>
            <FieldError msg={errors['targetTrack']} />
          </Field>

          {/* 3. 목표 대학 (선택) */}
          <Field
            label="3. 목표 대학 3순위"
            help="선택 항목입니다. 1순위부터 입력하세요."
          >
            <div className="space-y-2">
              {universities.map((uni, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[auto,1fr,1fr]"
                >
                  <span className="hidden self-center text-sm font-medium text-ink-500 sm:inline">
                    {idx + 1}순위
                  </span>
                  <input
                    type="text"
                    value={uni.name}
                    onChange={(e) =>
                      setUniversities((arr) =>
                        arr.map((u, i) =>
                          i === idx ? { ...u, name: e.target.value } : u
                        )
                      )
                    }
                    placeholder="대학명"
                    className={inputCls}
                    data-field-error={`targetUniversities.${idx}.name`}
                  />
                  <input
                    type="text"
                    value={uni.department ?? ''}
                    onChange={(e) =>
                      setUniversities((arr) =>
                        arr.map((u, i) =>
                          i === idx ? { ...u, department: e.target.value } : u
                        )
                      )
                    }
                    placeholder="학과 (선택)"
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </Field>

          {/* 4. 현재 학년·학기·학교 유형 */}
          <Field label="4. 현재 학년·학기와 학교 유형" required>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select
                label="학년"
                value={String(grade)}
                onChange={(v) => setGrade(Number(v))}
                options={[1, 2, 3].map((g) => ({
                  value: String(g),
                  label: `고${g}`,
                }))}
              />
              <Select
                label="학기"
                value={String(semester)}
                onChange={(v) => setSemester(Number(v) as 1 | 2)}
                options={[1, 2].map((s) => ({
                  value: String(s),
                  label: `${s}학기`,
                }))}
              />
              <Select
                label="학교 유형"
                value={schoolType}
                onChange={(v) => setSchoolType(v as SchoolType)}
                options={schoolTypes.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
              />
            </div>
            <FieldError
              msg={
                errors['currentStanding.grade'] ??
                errors['currentStanding.semester'] ??
                errors['currentStanding.schoolType']
              }
            />
          </Field>

          {/* 5. 부족 영역 (선택) */}
          <Field label="5. 본인이 부족하다고 느끼는 영역" help="선택 항목입니다.">
            <textarea
              rows={3}
              value={weakAreas}
              onChange={(e) => setWeakAreas(e.target.value)}
              placeholder="예: 진로 활동 일관성이 부족, 면접 답변 준비가 막막함 — 자유롭게 적어주세요"
              className="w-full rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              data-field-error="selfReportedWeakAreas"
            />
            <FieldError msg={errors['selfReportedWeakAreas']} />
          </Field>

          {submitError && (
            <ErrorState
              title="입력을 확인해주세요"
              message={submitError}
              tone="warning"
            />
          )}

          <div className="flex items-center justify-between border-t border-ink-100 pt-6">
            <Link href="/" className="text-sm text-ink-500 hover:text-ink-900">
              ← 처음으로
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {isPending ? '이동 중…' : '동의 단계로 →'}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}

const inputCls =
  'w-full rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100';

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <label className="text-base font-semibold text-ink-900">{label}</label>
        {required && (
          <span className="text-xs font-medium text-brand-600">필수</span>
        )}
      </div>
      {help && <p className="text-sm text-ink-500">{help}</p>}
      <div className="pt-2">{children}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition',
        active
          ? 'bg-white text-ink-900 shadow-sm'
          : 'text-ink-500 hover:text-ink-700'
      )}
    >
      {children}
    </button>
  );
}

function PdfUploader({
  status,
  onFile,
  onClear,
  inputRef,
  extractedText,
  onExtractedTextChange,
}: {
  status: PdfStatus;
  onFile: (f: File) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  extractedText: string;
  onExtractedTextChange: (t: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  function pick() {
    inputRef.current?.click();
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      {status.state === 'idle' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={pick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              pick();
            }
          }}
          className={cn(
            'cursor-pointer rounded-xl border-2 border-dashed bg-white px-4 py-10 text-center text-sm transition',
            dragOver
              ? 'border-brand-400 bg-brand-50/40'
              : 'border-ink-100 hover:border-brand-200'
          )}
        >
          <p className="font-medium text-ink-700">
            PDF 파일을 끌어다 놓거나 클릭해서 선택하세요
          </p>
          <p className="mt-1 text-xs text-ink-500">최대 10 MB · 텍스트 PDF만 (이미지 스캔은 미지원)</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pick();
            }}
            className="mt-3 rounded-md border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-200"
          >
            파일 선택
          </button>
        </div>
      )}

      {status.state === 'parsing' && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/30 px-4 py-4 text-sm">
          <p className="font-medium text-brand-700">{status.fileName} 분석 중…</p>
          <p className="mt-1 text-xs text-ink-500">
            {status.total > 0
              ? `페이지 ${status.current} / ${status.total}`
              : '파일 읽는 중'}
          </p>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/70"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              status.total > 0
                ? Math.round((status.current / status.total) * 100)
                : 0
            }
          >
            <div
              className="h-full bg-brand-500 transition-all duration-300"
              style={{
                width:
                  status.total > 0
                    ? `${(status.current / status.total) * 100}%`
                    : '12%',
              }}
            />
          </div>
        </div>
      )}

      {status.state === 'error' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/40 px-4 py-4 text-sm">
          <p className="font-medium text-rose-700">PDF 처리 실패</p>
          <p className="mt-1 text-xs text-rose-700/80">{status.message}</p>
          <button
            type="button"
            onClick={onClear}
            className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
          >
            다시 선택
          </button>
        </div>
      )}

      {status.state === 'done' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-emerald-800">
                ✓ {status.fileName}
              </p>
              <p className="mt-0.5 text-xs text-emerald-800/70">
                {status.pages}페이지 · {(status.sizeBytes / 1024 / 1024).toFixed(2)} MB
                · {extractedText.length.toLocaleString()}자 추출
              </p>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
            >
              다시 선택
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500">
              추출된 본문 (마스킹 확인 후 필요 시 직접 수정)
            </label>
            <textarea
              rows={8}
              value={extractedText}
              onChange={(e) => onExtractedTextChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </>
      )}
    </div>
  );
}

function RadioCard({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="block rounded-xl border border-ink-100 bg-white px-3 py-3 text-center text-sm font-medium text-ink-700 transition peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700">
        {label}
      </span>
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-ink-100 bg-white px-4 py-2.5 pr-10 text-sm text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
      {msg}
    </p>
  );
}

function MaskingChecklist({
  checked,
  onCheckedChange,
  selected,
  onToggle,
  errorMsg,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  selected: string[];
  onToggle: (id: string) => void;
  errorMsg?: string;
}) {
  return (
    <div
      className={cn(
        'mt-3 rounded-xl border px-4 py-3',
        errorMsg ? 'border-rose-200 bg-rose-50/40' : 'border-ink-100 bg-ink-100/40'
      )}
    >
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-brand-600"
          data-field-error="record.maskingApplied"
        />
        <span className="text-sm font-medium text-ink-900">
          업로드 전에 다음 식별정보가 가려져 있는지 확인했습니다
        </span>
      </label>
      <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-700 sm:grid-cols-5">
        {maskedFieldOptions.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => onToggle(opt.id)}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition',
                  active
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-ink-100 bg-white text-ink-500 hover:border-ink-300'
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    active ? 'bg-brand-500' : 'bg-ink-300'
                  )}
                />
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>
      <FieldError msg={errorMsg} />
    </div>
  );
}
