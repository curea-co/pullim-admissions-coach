import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';

// Phase A: 시각 셸. 실제 차단 로직·법정대리인 채널은 Phase E.
// 화면이 정의 §6.3 검수자 결정(P0 blocker)을 사용자에게 가시화.

type ConsentItem = {
  id: string;
  required: boolean;
  title: string;
  body: string;
};

const items: ConsentItem[] = [
  {
    id: 'terms',
    required: true,
    title: '서비스 이용약관 동의',
    body:
      '서비스 사용 방법·금지 행위·해지·면책 등에 관한 기본 약관에 동의합니다.',
  },
  {
    id: 'privacy',
    required: true,
    title: '개인정보 수집·이용 동의 (민감정보 포함)',
    body:
      '학종 진단을 위해 생기부에 포함된 학습·활동 정보를 수집·이용합니다. 식별정보는 입력 단계에서 가린 상태로 받으며, 저장 시 추가 보호 조치를 적용합니다. 보관 기간 12개월.',
  },
  {
    id: 'guardian',
    required: true,
    title: '미성년자 — 법정대리인 동의',
    body:
      '본인이 미성년자(만 19세 미만)인 경우, 법정대리인(부모님 등)의 동의가 필요합니다. 출시 단계에서는 카카오 알림톡으로 보호자 동의를 한 번 더 확인합니다.',
  },
];

export default function ConsentPage() {
  return (
    <>
      <PageHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">동의</h1>
          <StepIndicator current="consent" />
        </div>
        <p className="mb-8 text-ink-700">
          학종 진단 서비스를 진행하려면 아래 3가지 동의가 모두 필요합니다.
          한 가지라도 동의하지 않으면 다음 단계로 진행할 수 없습니다.
        </p>

        <section className="space-y-3">
          {items.map((item) => (
            <ConsentRow key={item.id} item={item} />
          ))}
        </section>

        <BlockerNote />

        <div className="mt-8 flex items-center justify-between border-t border-ink-100 pt-6">
          <Link
            href="/submit"
            className="text-sm text-ink-500 hover:text-ink-900"
          >
            ← 입력으로
          </Link>
          <Link
            href="/result"
            className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            동의 후 진단 시작 →
          </Link>
        </div>
      </main>
    </>
  );
}

function ConsentRow({ item }: { item: ConsentItem }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-2xl border border-ink-100 bg-white p-5 transition hover:border-brand-200 has-[input:checked]:border-brand-300 has-[input:checked]:bg-brand-50/40">
      <input
        type="checkbox"
        defaultChecked
        className="mt-1.5 size-4 shrink-0 accent-brand-600"
      />
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-ink-900">{item.title}</span>
          {item.required && (
            <span className="text-xs font-medium text-brand-600">필수</span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{item.body}</p>
      </div>
    </label>
  );
}

function BlockerNote() {
  return (
    <aside
      role="note"
      className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900"
    >
      <p className="font-semibold">미성년자 보호 정책 (출시 차단 조건)</p>
      <p className="mt-1 text-amber-900/80">
        본 서비스는 미성년자 법정대리인 동의 절차와 생기부 보관·삭제 정책이 모두
        가동된 이후에만 실제 사용자 데이터를 받습니다. 본 화면은 그 절차를 사용자에게
        가시화하는 Phase A 시각 셸입니다.
      </p>
    </aside>
  );
}
