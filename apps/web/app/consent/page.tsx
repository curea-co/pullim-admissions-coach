'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { consentSchema } from '@pullim/shared';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { ErrorState } from '@/components/error-state';
import { validate } from '@/lib/validation';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/auth/auth-provider';
import { loadSubmittedPayload, saveSubmittedPayload } from '@/lib/submitted-payload';
import { cn } from '@/lib/utils';

// Phase B: 클라이언트 차단 로직.
// 실 발송 채널(카카오 알림톡 등)·세션·DB 저장은 Phase E.
// 본 화면은 정의 §6.3 가드를 사용자에게 가시화하고, 미충족 시 다음 단계 진입을 차단한다.

type ConsentItem = {
  id: 'terms' | 'privacy' | 'guardian';
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
      '학생부 종합 전형 진단을 위해 생기부에 포함된 학습·활동 정보를 수집·이용합니다. 식별정보는 입력 단계에서 가린 상태로 받으며, 저장 시 추가 보호 조치를 적용합니다. 보관 기간 30일 (결과 생성 후 30일, 학생 요청 시 즉시 삭제).',
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 미성년 여부 기본값 = 가입 시 생년월일(user.isMinor). 사용자가 토글로 직접 바꾸기 전까지 자동 반영.
  const { user } = useAuth();
  const [isMinor, setIsMinor] = useState(true);
  const [minorTouched, setMinorTouched] = useState(false);
  useEffect(() => {
    if (!minorTouched && user) setIsMinor(user.isMinor);
  }, [user, minorTouched]);
  const [checked, setChecked] = useState<Record<ConsentItem['id'], boolean>>({
    terms: false,
    privacy: false,
    guardian: false,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  function toggle(id: ConsentItem['id'], v: boolean) {
    setChecked((prev) => ({ ...prev, [id]: v }));
  }

  function toggleAll(v: boolean) {
    setChecked({ terms: v, privacy: v, guardian: v });
  }

  function allRequiredMet(): boolean {
    if (!checked.terms || !checked.privacy) return false;
    // 미성년자가 아니면 guardian 동의는 면제. 미성년자면 필수.
    if (isMinor && !checked.guardian) return false;
    return true;
  }

  function handleProceed() {
    setSubmitError(null);

    if (!allRequiredMet()) {
      const missing: string[] = [];
      if (!checked.terms) missing.push('이용약관');
      if (!checked.privacy) missing.push('개인정보');
      if (isMinor && !checked.guardian) missing.push('법정대리인');
      setSubmitError(
        `진행하려면 ${missing.join(' · ')} 동의가 필요합니다.`
      );
      return;
    }

    // Zod로 schema 측면 재검증 (literal(true) 강제 / 미성년→guardian 강제)
    const payload = {
      isMinor,
      termsAgreed: checked.terms as true,
      privacyPolicyAgreed: checked.privacy as true,
      guardianConsentObtained: checked.guardian,
      consentTimestamp: new Date().toISOString(),
    };
    const r = validate(consentSchema, payload);
    if (!r.ok) {
      const firstKey = Object.keys(r.errors)[0];
      setSubmitError(
        `동의 항목을 확인해주세요${
          firstKey ? ` (${r.errors[firstKey]})` : ''
        }.`
      );
      return;
    }

    // 동의 정합성: /submit가 저장한 stub consent를 이 화면에서 받은 *실제* 동의값으로
    // 갱신해야 서버(/api/analyze)가 올바른 동의 상태로 분석한다.
    // 이번 제출 payload가 없으면(직접 진입/저장 실패) 진행을 차단한다 — 이전/타 학생의
    // record에 동의값만 덮어 잘못 분석하는 것을 막는 fail-closed.
    const existing = loadSubmittedPayload();
    if (!existing || typeof existing !== 'object') {
      setSubmitError('제출 데이터를 찾을 수 없어요. 처음부터 다시 제출해주세요.');
      return;
    }
    const merged = { ...(existing as Record<string, unknown>), consent: payload };
    if (!saveSubmittedPayload(merged)) {
      setSubmitError('동의 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      return;
    }

    startTransition(() => {
      router.push('/processing');
    });
  }

  const allChecked = checked.terms && checked.privacy && checked.guardian;
  const canProceed = allRequiredMet();

  return (
    <RequireAuth>
    <>
      <PageHeader />
      <div className="w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">동의</h1>
          <StepIndicator current="consent" />
        </div>
        <p className="mb-6 text-ink-700">
          학생부 종합 전형 진단 서비스를 진행하려면 아래 3가지 동의가 모두 필요합니다.
          한 가지라도 동의하지 않으면 다음 단계로 진행할 수 없습니다.
        </p>

        {/* 미성년자 여부 — 가입 생년월일로 기본값 설정, 필요 시 사용자가 직접 변경. */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">미성년자(만 19세 미만)인가요?</p>
            <p className="mt-0.5 text-xs text-ink-500">
              미성년자라면 법정대리인 동의가 필수로 추가됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setMinorTouched(true); setIsMinor((v) => !v); }}
            className="rounded-md border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {isMinor ? '미성년 · 변경' : '성인 · 변경'}
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-xl bg-ink-100/50 px-4 py-2.5 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => toggleAll(e.target.checked)}
              className="size-4 accent-brand-600"
            />
            <span className="font-medium text-ink-900">전체 동의</span>
          </label>
          <span className="text-xs text-ink-500">필수 {isMinor ? 3 : 2}개</span>
        </div>

        <section className="space-y-3">
          {items.map((item) => (
            <ConsentRow
              key={item.id}
              item={item}
              required={item.id !== 'guardian' || isMinor}
              dim={item.id === 'guardian' && !isMinor}
              checked={checked[item.id]}
              onChange={(v) => toggle(item.id, v)}
            />
          ))}
        </section>

        {submitError ? (
          <ErrorState
            title="동의가 부족합니다"
            message={submitError}
            tone="warning"
            className="mt-6"
          />
        ) : (
          <BlockerNote />
        )}

        {/* aria-live 안내: 버튼이 비활성 상태일 때 미충족 조건을 스크린리더에 전달 */}
        <p
          id="proceed-status"
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {!canProceed
            ? (() => {
                const missing: string[] = [];
                if (!checked.terms) missing.push('이용약관');
                if (!checked.privacy) missing.push('개인정보');
                if (isMinor && !checked.guardian) missing.push('법정대리인');
                return missing.length > 0
                  ? `필수 동의 ${missing.length}개(${missing.join(', ')})를 체크해야 진행할 수 있습니다.`
                  : '';
              })()
            : ''}
        </p>

        <div className="mt-8 flex items-center justify-between border-t border-ink-100 pt-6">
          <Link
            href="/submit"
            className="rounded text-sm text-ink-500 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            ← 입력으로
          </Link>
          <button
            type="button"
            onClick={() => { if (!canProceed || isPending) return; handleProceed(); }}
            aria-disabled={!canProceed || isPending}
            aria-describedby={!canProceed ? 'proceed-status' : undefined}
            className={cn(
              'rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2',
              (!canProceed || isPending) && 'cursor-not-allowed opacity-50'
            )}
          >
            {isPending ? '이동 중…' : '동의 후 진단 시작 →'}
          </button>
        </div>
      </div>
    </>
    </RequireAuth>
  );
}

function ConsentRow({
  item,
  required,
  dim,
  checked,
  onChange,
}: {
  item: ConsentItem;
  required: boolean;
  dim?: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={
        dim
          ? 'flex cursor-not-allowed gap-3 rounded-2xl border border-ink-100 bg-ink-100/30 p-5 opacity-60'
          : 'flex cursor-pointer gap-3 rounded-2xl border border-ink-100 bg-white p-5 transition hover:border-brand-200 has-[input:checked]:border-brand-300 has-[input:checked]:bg-brand-50/40'
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={dim}
        className="mt-1.5 size-4 shrink-0 accent-brand-600"
      />
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-ink-900">
            {item.title}
          </span>
          {required ? (
            <span className="text-xs font-medium text-brand-600">필수</span>
          ) : (
            <span className="text-xs font-medium text-ink-500">생략 가능</span>
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
        미리 안내하는 베타 미리보기입니다.
      </p>
    </aside>
  );
}
