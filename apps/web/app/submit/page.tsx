import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { parkJunho } from '@/lib/mock/park-junho';

// Phase A: 시각 셸. 실 검증·상태 관리·업로드는 Phase B/C에서 NestJS api·Zod와 결합.

const tracks = [
  { value: 'humanities', label: '인문' },
  { value: 'engineering', label: '공학' },
  { value: 'medical_natural', label: '의학·자연' },
  { value: 'arts_athletics', label: '예체능' },
] as const;

const schoolTypes = [
  { value: 'general', label: '일반고' },
  { value: 'special_purpose', label: '특목고' },
  { value: 'autonomous_private', label: '자사고' },
] as const;

const grades = [1, 2, 3] as const;
const semesters = [1, 2] as const;

export default function SubmitPage() {
  return (
    <>
      <PageHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            생기부 제출
          </h1>
          <StepIndicator current="submit" />
        </div>
        <p className="mb-8 text-ink-700">
          학종 평가 기준 5항목으로 진단하기 위해 5가지 정보를 받습니다.
          개인 식별정보는 입력 단계에서 가려주세요.
        </p>

        <form className="space-y-8">
          {/* 1. 생기부 입력 */}
          <Field
            label="1. 생기부 파일 또는 텍스트"
            required
            help="개인 식별정보(이름·학교명·생년월일·전화번호 등)를 가린 상태로 업로드하거나 붙여넣어 주세요."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-dashed border-ink-100 bg-white px-4 py-6 text-center text-sm text-ink-500">
                <p className="font-medium text-ink-700">PDF 업로드</p>
                <p className="mt-1 text-xs">드래그·드롭 또는 클릭 (준비 중)</p>
              </div>
              <textarea
                rows={6}
                placeholder="또는 텍스트로 붙여넣기 (마스킹된 본문)"
                className="w-full rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <MaskingChecklist />
          </Field>

          {/* 2. 지원 학부 4계열 */}
          <Field label="2. 지원 학부 (택 1)" required>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {tracks.map((t) => (
                <RadioCard
                  key={t.value}
                  name="targetTrack"
                  value={t.value}
                  label={t.label}
                  defaultChecked={t.value === parkJunho.profile.targetTrack}
                />
              ))}
            </div>
          </Field>

          {/* 3. 목표 대학 3순위 (선택) */}
          <Field
            label="3. 목표 대학 3순위"
            help="선택 항목입니다. 1순위부터 입력하세요."
          >
            <div className="space-y-2">
              {parkJunho.profile.targetUniversities.map((uni, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[auto,1fr,1fr]"
                >
                  <span className="hidden self-center text-sm font-medium text-ink-500 sm:inline">
                    {idx + 1}순위
                  </span>
                  <input
                    type="text"
                    defaultValue={uni.name}
                    placeholder="대학명"
                    className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <input
                    type="text"
                    defaultValue={uni.department}
                    placeholder="학과 (선택)"
                    className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              ))}
            </div>
          </Field>

          {/* 4. 현재 학년·학기 + 학교 유형 */}
          <Field label="4. 현재 학년·학기와 학교 유형" required>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select
                label="학년"
                defaultValue={String(parkJunho.identity.grade)}
                options={grades.map((g) => ({ value: String(g), label: `고${g}` }))}
              />
              <Select
                label="학기"
                defaultValue={String(parkJunho.identity.semester)}
                options={semesters.map((s) => ({
                  value: String(s),
                  label: `${s}학기`,
                }))}
              />
              <Select
                label="학교 유형"
                defaultValue={parkJunho.identity.schoolType}
                options={schoolTypes.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
          </Field>

          {/* 5. 부족 영역 (선택) */}
          <Field label="5. 본인이 부족하다고 느끼는 영역" help="선택 항목입니다.">
            <textarea
              rows={3}
              defaultValue={parkJunho.profile.weakAreas}
              placeholder="예: 진로 활동 일관성, 면접 답변 준비 등 자유롭게"
              className="w-full rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          <div className="flex items-center justify-between border-t border-ink-100 pt-6">
            <Link href="/" className="text-sm text-ink-500 hover:text-ink-900">
              ← 처음으로
            </Link>
            <Link
              href="/consent"
              className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              동의 단계로 →
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}

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

function RadioCard({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
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
  defaultValue,
  options,
}: {
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-500">{label}</span>
      <select
        defaultValue={defaultValue}
        className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MaskingChecklist() {
  const items = [
    '학생 이름',
    '학교명',
    '생년월일',
    '전화번호·주소',
    '교사 성명',
  ];
  return (
    <div className="mt-3 rounded-xl bg-ink-100/40 px-4 py-3">
      <p className="text-xs font-medium text-ink-700">
        업로드 전 다음 식별정보가 가려져 있는지 확인하세요
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-500 sm:grid-cols-5">
        {items.map((i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-brand-500" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
