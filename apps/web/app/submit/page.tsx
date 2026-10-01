'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SCHEMA_VERSION,
  studentProfileSchema,
  targetTrackLabel,
  schoolTypeLabel,
  type TargetTrack,
  type SchoolType,
  type Consent,
  detectPii,
  redactPii,
  type PiiMatch,
} from '@pullim/shared';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { GuardrailLabel } from '@/components/guardrail-label';
import { ErrorState } from '@/components/error-state';
import { fieldLabel, validate, type FieldErrors } from '@/lib/validation';
import { extractPdfText, validatePdfFile, type PdfExtractHandle } from '@/lib/pdf';
import { saveSubmittedProfile } from '@/lib/submitted-profile';
import { saveSubmittedPayload } from '@/lib/submitted-payload';
import { cn } from '@/lib/utils';
import { RequireAuth } from '@/components/auth/require-auth';
import { RequireAdmissionsAccess } from '@/components/auth/require-admissions-access';

type InputType = 'pdf_upload' | 'text_paste';

type PdfStatus =
  | { state: 'idle' }
  | { state: 'parsing'; current: number; total: number; fileName: string }
  | { state: 'done'; fileName: string; pages: number; sizeBytes: number }
  | { state: 'error'; message: string };

// "기타"는 선택지에서 뺀다 — 분석은 인문과 완전히 같게 돌아서(계열 기준·면접 유형 모두) 화면
// 문구와 동작이 어긋났다. 값(`other`)은 스키마에 남긴다: 이미 들어온 제출이 보존 기간(30일)
// 동안 재분석·결과 요약에서 이 값을 읽는다.
const HIDDEN_TRACKS: readonly TargetTrack[] = ['other'];

const tracks: { value: TargetTrack; label: string }[] = (
  Object.entries(targetTrackLabel) as [TargetTrack, string][]
)
  .filter(([value]) => !HIDDEN_TRACKS.includes(value))
  .map(([value, label]) => ({ value, label }));

// 드롭다운에서만 포함 범위를 덧붙인다. 공용 라벨(schoolTypeLabel)은 결과 헤더 요약
// ("고3 2학기 · 특목고 · 이공")에도 쓰이므로 짧게 둔다.
const SCHOOL_TYPE_HINT: Partial<Record<SchoolType, string>> = {
  special_purpose: '영재학교 포함',
  vocational: '마이스터고 포함',
  // 분석이 아직 일반고 기준이다(서버가 ged → general). 검정고시 전용 기준은 후속 작업.
  ged: '업데이트 예정',
};

const schoolTypes: { value: SchoolType; label: string }[] = (
  Object.entries(schoolTypeLabel) as [SchoolType, string][]
).map(([value, label]) => ({
  value,
  label: SCHOOL_TYPE_HINT[value] ? `${label} (${SCHOOL_TYPE_HINT[value]})` : label,
}));

// 폼 초기값. 예전에는 박준호 데모 mock 에서 끌어왔는데, mock 을 걷어내면서 여기 상수로 옮겼다
// (값은 그대로 — 주 이용자가 고3 2학기 일반고 이공계열이라 입력 횟수가 가장 적은 기본값이다).
const DEFAULT_TRACK: TargetTrack = 'science_engineering';
const DEFAULT_GRADE = 3;
const DEFAULT_SEMESTER: 1 | 2 = 2;
const DEFAULT_SCHOOL_TYPE: SchoolType = 'general';

export default function SubmitPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 폼 상태 — 박준호 mock으로 초기화 (Phase A 시연 흐름 유지)
  // 기본 탭은 PDF — 주 이용자는 생기부 PDF를 가진 재학생이다. 텍스트 탭은 검정고시(생기부 없음)와
  // PDF 추출 실패 시의 대체 경로.
  const [inputType, setInputType] = useState<InputType>('pdf_upload');
  // 탭마다 본문을 따로 든다. PDF 추출본은 **서비스 안에서 고칠 수 없다** — 업로드한 파일이 원본이고,
  // 여기서 A를 B로 바꿀 수 있으면 사용자가 B가 적힌 PDF를 가졌다고 착각한다. 고치려면 파일을 다시
  // 올린다. 텍스트 탭은 사용자가 직접 쓰는 공간이라 수정할 수 있다. 한 상태를 공유하면 PDF 추출본이
  // 텍스트 탭으로 넘어가 편집 가능해지므로 분리한다.
  const [pdfText, setPdfText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const recordText = inputType === 'pdf_upload' ? pdfText : pasteText;
  // PDF 미리보기의 가리기/보이기. 기본은 가리기 — 제출 내용과는 무관하다(제출은 항상 가린 본문).
  const [showOriginal, setShowOriginal] = useState(false);
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
  // 텍스트 탭 하이라이트용 탐지 결과. 입력 중 매 키마다 돌지 않게 디바운스하고, 탐지 당시 본문을
  // 함께 들고 있다가 **지금 본문과 같을 때만** 쓴다 — 오프셋이 어긋난 하이라이트를 그리지 않게.
  const [pasteScan, setPasteScan] = useState<{ text: string; matches: PiiMatch[] }>({
    text: '',
    matches: [],
  });

  const [targetTrack, setTargetTrack] = useState<TargetTrack>(DEFAULT_TRACK);
  const [universities, setUniversities] = useState<
    { name: string; department?: string }[]
  >([{ name: '' }, { name: '' }, { name: '' }]);
  const [grade, setGrade] = useState<number>(DEFAULT_GRADE);
  const [semester, setSemester] = useState<1 | 2>(DEFAULT_SEMESTER);
  const [schoolType, setSchoolType] = useState<SchoolType>(DEFAULT_SCHOOL_TYPE);
  const [weakAreas, setWeakAreas] = useState<string>('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setPasteScan({ text: pasteText, matches: detectPii(pasteText) });
    }, 300);
    return () => clearTimeout(id);
  }, [pasteText]);
  const pasteMatches = pasteScan.text === pasteText ? pasteScan.matches : [];

  // PDF 추출본은 업로드 때 한 번만 바뀌므로 바로 탐지한다(가리기 전 원문이 잠깐이라도 보이지 않게).
  const pdfMasked = useMemo(() => redactPii(pdfText, detectPii(pdfText)), [pdfText]);

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
    setPdfText(result.text);
    setShowOriginal(false);
  }

  function clearPdf() {
    // codex review P2 후속: 진행 중 파싱을 실제 중단 + stale 가드 동시 적용.
    currentPdfHandleRef.current?.cancel();
    currentPdfHandleRef.current = null;
    pdfRequestIdRef.current++;
    setPdfStatus({ state: 'idle' });
    setPdfText('');
    setShowOriginal(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function buildPayload() {
    // Phase A+B: PDF든 텍스트든 최종 제출은 항상 text_paste.
    // PDF 탭은 *입력 방법*이고, 추출된 텍스트가 recordText에 들어가 있다.
    // Phase D에서 백엔드 S3 업로드 도착 시 pdf_upload 변환 경로 추가.
    //
    // 탐지된 식별정보는 등급(block·warn)과 관계없이 **전부 가려서** 보낸다. 화면의 원문은 그대로 두고
    // 여기서만 가린다 — 사용자가 버튼을 눌러야 가려지던 예전 방식은 홈의 "자동으로 가림"과 달랐다.
    // 디바운스된 탐지 결과를 쓰지 않고 지금 본문으로 다시 탐지한다(오프셋 어긋남 방지).
    const matches = detectPii(recordText);
    const recordPart = {
      inputType: 'text_paste' as const,
      text: redactPii(recordText, matches),
      maskingApplied: true as const,
      maskedFields: Array.from(new Set(matches.map((m) => m.maskedField))),
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
      //
      // **`Consent` 타입을 명시한다.** 이 객체는 consentSchema 의 모양을 손으로 베껴 둔 것이라,
      // 스키마 필드가 바뀌면 여기만 조용히 뒤처진다. 실제로 그렇게 깨졌다 — 필드가
      // `isMinor` → `guardianRequired` 로 바뀌었는데(만14 정정) 이 stub 이 안 따라와
      // `/submit` 의 모든 제출이 `consent.guardianRequired: Required` 로 막혔다.
      // 그 키는 FIELD_LABELS 에도 `data-field-error` 앵커에도 없어서 화면에는
      // "1개 항목을 확인해주세요. (입력 항목)" 만 뜨고 **어느 칸이 문제인지 표시되지 않았다.**
      // 타입을 붙이면 다음 리네임은 런타임이 아니라 tsc 에서 걸린다.
      consent: {
        guardianRequired: true,
        termsAgreed: true,
        privacyPolicyAgreed: true,
        guardianConsentObtained: true,
        consentTimestamp: new Date().toISOString(),
      } satisfies Consent,
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
          first ? ` (${fieldLabel(first)})` : ''
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
    // #25: 결과 헤더 표시용 비-PII 프로필을 sessionStorage에 저장(생기부 text는 저장 안 함).
    saveSubmittedProfile({
      grade,
      semester,
      schoolType,
      targetTrack,
      targetUniversities: universities.filter((u) => u.name.trim().length > 0),
    });
    // processing 페이지가 admissions 백엔드로 접수할 payload 를 sessionStorage 에 임시 저장.
    // 저장이 실패하면(프라이빗 모드 등) 다음 단계로 넘어가지 않는다 — 이전 제출 payload가
    // 남아 다른 학생 데이터가 분석되는 것을 막기 위한 fail-closed.
    if (!saveSubmittedPayload(buildPayload())) {
      setSubmitError('제출 데이터를 저장하지 못했어요. 브라우저 저장소 설정(프라이빗 모드 등)을 확인하고 다시 시도해주세요.');
      return;
    }
    startTransition(() => {
      router.push('/consent');
    });
  }

  return (
    <RequireAuth>
    <RequireAdmissionsAccess>
    <>
      <PageHeader />
      <div className="w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            생기부 제출
          </h1>
          <StepIndicator current="submit" />
        </div>
        <p className="mb-6 text-ink-700">
          진단에 필요한 5가지를 입력해 주세요.
        </p>

        <GuardrailLabel variant="general" className="mb-6" />

        <form className="space-y-8" noValidate onSubmit={handleSubmit}>
          {/* 1. 생기부 입력 */}
          <Field
            label="1. 생기부 파일 또는 텍스트"
            required
            help="PDF 또는 텍스트를 입력하면 개인정보를 자동으로 확인합니다. 제출 전에 감지 결과를 확인해 주세요."
          >
            {/* 에러 스크롤 앵커는 탭 영역 전체에 둔다. 텍스트 칸에만 두면 PDF 탭(기본)에서 제출 시
                스크롤할 대상이 없다. */}
            <div data-field-error="record.text">
            <div role="tablist" aria-label="입력 방식 선택" className="mb-3 flex gap-2 rounded-xl bg-ink-100/60 p-1 text-sm">
              <TabButton
                active={inputType === 'pdf_upload'}
                onClick={() => setInputType('pdf_upload')}
                panelId="tab-panel-pdf"
              >
                PDF 업로드
              </TabButton>
              <TabButton
                active={inputType === 'text_paste'}
                onClick={() => setInputType('text_paste')}
                panelId="tab-panel-text"
              >
                텍스트 붙여넣기
              </TabButton>
            </div>

            {inputType === 'text_paste' ? (
              <div id="tab-panel-text" role="tabpanel">
                <PiiHighlightTextarea
                  value={pasteText}
                  onChange={setPasteText}
                  matches={pasteMatches}
                  invalid={!!errors['record.text']}
                />
                {pasteMatches.length > 0 && (
                  <p className="mt-2 text-xs text-amber-700">표시된 텍스트는 가려져서 업로드돼요.</p>
                )}
              </div>
            ) : (
              <div id="tab-panel-pdf" role="tabpanel">
                <PdfUploader
                  status={pdfStatus}
                  onFile={handlePdfFile}
                  onClear={clearPdf}
                  inputRef={fileInputRef}
                  extractedText={pdfText}
                  maskedText={pdfMasked}
                  showOriginal={showOriginal}
                  onShowOriginalChange={setShowOriginal}
                />
              </div>
            )}
            <FieldError msg={errors['record.text']} />
            </div>
          </Field>

          {/* 2. 지원 학부 */}
          <Field label="2. 지원 학부 (택 1)" required>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
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
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_1fr]"
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
                    aria-label={`${idx + 1}순위 대학명`}
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
                    aria-label={`${idx + 1}순위 학과 (선택)`}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </Field>

          {/* 4. 현재 학년·학기·학교 유형 */}
          <Field label="4. 학년·학교 유형" required>
            {/* 학교 유형 칸을 넓게 — "특성화고 (마이스터고 포함)" 이 잘리지 않게.
                Tailwind v4 임의값은 쉼표를 공백으로 바꾸지 않는다. `[1fr,1fr,2fr]` 은 무효 CSS가 되어
                데스크톱에서도 한 줄씩 쌓인다 — 구분자는 `_`. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_2fr]">
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
              aria-label="본인이 부족하다고 느끼는 영역 (선택)"
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
            <Link href="/" className="rounded text-sm text-ink-500 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
              ← 처음으로
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? '이동 중…' : '동의 단계로 →'}
            </button>
          </div>
        </form>
      </div>
    </>
    </RequireAdmissionsAccess>
    </RequireAuth>
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
  panelId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  panelId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
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
  maskedText,
  showOriginal,
  onShowOriginalChange,
}: {
  status: PdfStatus;
  onFile: (f: File) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  extractedText: string;
  maskedText: string;
  showOriginal: boolean;
  onShowOriginalChange: (v: boolean) => void;
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
            'cursor-pointer rounded-xl border-2 border-dashed bg-white px-4 py-10 text-center text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
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
            className="mt-3 rounded-md border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
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
            className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
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
              className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              다시 선택
            </button>
          </div>
          {/* 읽기 전용 — 업로드한 파일이 원본이라 여기서 고칠 수 없다(고치려면 파일을 다시 올린다).
              가린 모습을 그대로 보여 주고, 토글로 원문을 확인한다. 가린 게 없으면 토글을 그리지 않는다. */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span id="pdf-extracted-label" className="text-xs font-medium text-ink-500">
                추출된 본문
              </span>
              {maskedText !== extractedText && (
                <MaskToggle showOriginal={showOriginal} onChange={onShowOriginalChange} />
              )}
            </div>
            <div
              tabIndex={0}
              aria-labelledby="pdf-extracted-label"
              className="mt-1 max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-ink-100 bg-ink-100/30 px-4 py-3 text-sm leading-relaxed text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
            >
              {showOriginal ? extractedText : maskedText}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MaskToggle({
  showOriginal,
  onChange,
}: {
  showOriginal: boolean;
  onChange: (v: boolean) => void;
}) {
  const options = [
    { label: '가리기', value: false },
    { label: '보이기', value: true },
  ];
  return (
    <div role="group" aria-label="개인정보 표시" className="inline-flex rounded-lg bg-ink-100/60 p-0.5 text-xs font-medium">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={showOriginal === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            showOriginal === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// textarea 와 뒤 하이라이트 층이 **글자 단위로 같은 자리에** 줄바꿈돼야 한다. 그래서 둘이 같은
// 패딩·글꼴·줄간격을 쓰고, 스크롤바 자리도 둘 다 미리 잡아 둔다(한쪽에만 스크롤바가 생기면 폭이
// 달라져 줄바꿈 위치가 어긋난다).
const HIGHLIGHT_BOX = 'px-4 py-3 text-sm leading-relaxed [scrollbar-gutter:stable]';

/**
 * 텍스트 탭 입력칸. 본문은 원문 그대로 편집하고, 가려서 올라갈 구간만 뒤에서 칠한다.
 * 가린 모습([이름] 등)을 입력칸에 보여 주지 않는 이유: 계속 고쳐 쓰는 공간이라, 자리표시가 끼면
 * 사용자가 원치 않는 수정을 해야 할 수 있다.
 */
function PiiHighlightTextarea({
  value,
  onChange,
  matches,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  matches: PiiMatch[];
  invalid: boolean;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of [...matches].sort((a, b) => a.index - b.index)) {
    if (m.index < cursor) continue;
    parts.push(value.slice(cursor, m.index));
    parts.push(
      <mark key={m.index} className="rounded-sm bg-amber-200/70 text-transparent">
        {value.slice(m.index, m.index + m.length)}
      </mark>
    );
    cursor = m.index + m.length;
  }
  parts.push(value.slice(cursor));

  return (
    <div className="relative rounded-xl border border-ink-100 bg-white focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
      <div
        ref={backdropRef}
        aria-hidden
        className={cn(
          HIGHLIGHT_BOX,
          'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent'
        )}
      >
        {parts}
        {/* 마지막 줄이 개행으로 끝날 때 textarea 와 높이를 맞춘다. */}
        {'\n'}
      </div>
      <textarea
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        placeholder="여기에 생기부 본문을 붙여넣어 주세요"
        aria-label="생기부 본문"
        aria-invalid={invalid}
        className={cn(
          HIGHLIGHT_BOX,
          'relative block w-full resize-y rounded-xl bg-transparent text-ink-900 placeholder:text-ink-300 focus:outline-none'
        )}
      />
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
