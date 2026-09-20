'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { consentSchema } from '@pullim/shared';
import { PageHeader } from '@/components/page-header';
import { StepIndicator } from '@/components/step-indicator';
import { ErrorState } from '@/components/error-state';
import { validate } from '@/lib/validation';
import { RequireAuth } from '@/components/auth/require-auth';
import { RequireAdmissionsAccess } from '@/components/auth/require-admissions-access';
import { useAuth } from '@/components/auth/auth-provider';
import {
  loadSubmittedPayload,
  saveSubmittedPayload,
  mergeConsentIntoPayload,
} from '@/lib/submitted-payload';
import { requiresGuardianConsent, isConsentGateMet } from '@/lib/consent-gate';
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
    title: '만 14세 미만 — 법정대리인 동의',
    body:
      '본인이 만 14세 미만인 경우, 법정대리인(부모님 등)의 동의가 필요합니다. 만 14세 이상은 본인 동의로 진행하되, 보호자에게 이용 사실을 알리고 사용하시길 권합니다.',
  },
];

export default function ConsentPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 법정대리인 동의 필요 여부 = 가입 생년월일로 산정된 **권위값**(user.ageBand, 만14 경계)에서만 온다.
  // 화면에서 임의 변경할 수 없다 — 스스로 성인으로 바꿔 동의를 우회하는 것을 막는다(#52).
  // 미확정(unknown)이면 보수적으로 '필요'. 기준이 만19 → 만14 로 정정된 경위는 lib/consent-gate.ts 주석.
  const { user, status } = useAuth();
  const guardianRequired = requiresGuardianConsent(user?.ageBand);
  // 세션이 이 화면에서 만료되면 ageBand 가 사라져 guardianRequired 가 true 로 뒤집힌다.
  // fail-closed 자체는 맞지만, 안내가 없으면 사용자는 **갑자기 못 채우는 체크박스**를 만난다
  // (필수 2개 → 3개, 배지 '만 14세 이상' → '만 14세 미만'). 실제로 QA 중 그렇게 됐다.
  // 상태를 말해 주고 로그인으로 보낸다 — 조용히 게이트만 조이지 않는다.
  const sessionLost = status === 'guest';
  const [checked, setChecked] = useState<Record<ConsentItem['id'], boolean>>({
    terms: false,
    privacy: false,
    guardian: false,
  });
  // 에러는 제목까지 함께 들고 다닌다 — 제목이 '동의가 부족합니다' 로 고정돼 있어서,
  // 제출 데이터 분실·저장 실패에도 동의를 다시 보라고 엉뚱한 곳을 가리켰다(QA 2026-09-20).
  const [submitError, setSubmitError] = useState<{ title: string; message: string } | null>(null);

  function toggle(id: ConsentItem['id'], v: boolean) {
    setChecked((prev) => ({ ...prev, [id]: v }));
  }

  function toggleAll(v: boolean) {
    // 성인은 보호자 동의가 필수 항목이 아니므로 "전체 동의"에서 제외(guardian 유지) —
    // 성인이 전체 동의해도 guardian 미체크로 진행버튼과 어긋나던 불일치 해소(Codex #65).
    setChecked((prev) => ({ terms: v, privacy: v, guardian: guardianRequired ? v : prev.guardian }));
  }

  function allRequiredMet(): boolean {
    // 게이트 로직은 lib/consent-gate(순수·테스트됨)로 위임 — 성인 면제/미성년 필수 회귀 고정(#65).
    return isConsentGateMet({
      guardianRequired,
      terms: checked.terms,
      privacy: checked.privacy,
      guardian: checked.guardian,
    });
  }

  function handleProceed() {
    setSubmitError(null);

    if (!allRequiredMet()) {
      const missing: string[] = [];
      if (!checked.terms) missing.push('이용약관');
      if (!checked.privacy) missing.push('개인정보');
      if (guardianRequired && !checked.guardian) missing.push('법정대리인');
      setSubmitError({
        title: '동의가 부족합니다',
        message: `진행하려면 ${missing.join(' · ')} 동의가 필요합니다.`,
      });
      return;
    }

    // Zod로 schema 측면 재검증 (literal(true) 강제 / 만14 미만→guardian 강제)
    const payload = {
      guardianRequired,
      termsAgreed: checked.terms as true,
      privacyPolicyAgreed: checked.privacy as true,
      guardianConsentObtained: checked.guardian,
      consentTimestamp: new Date().toISOString(),
    };
    const r = validate(consentSchema, payload);
    if (!r.ok) {
      const firstKey = Object.keys(r.errors)[0];
      setSubmitError({
        title: '동의가 부족합니다',
        message: `동의 항목을 확인해주세요${firstKey ? ` (${r.errors[firstKey]})` : ''}.`,
      });
      return;
    }

    // 동의 정합성: /submit가 저장한 stub consent를 이 화면에서 받은 *실제* 동의값으로
    // 갱신해야 서버(admissions consents)가 올바른 동의 상태로 적재한다.
    // 이번 제출 payload가 없으면(직접 진입/저장 실패) 진행을 차단한다 — 이전/타 학생의
    // record에 동의값만 덮어 잘못 분석하는 것을 막는 fail-closed.
    const existing = loadSubmittedPayload();
    if (!existing || typeof existing !== 'object') {
      setSubmitError({
        title: '제출 내용을 찾을 수 없습니다',
        message: '생기부 입력 내용이 남아 있지 않아요. 처음부터 다시 제출해주세요.',
      });
      return;
    }
    const merged = mergeConsentIntoPayload(existing, payload);
    if (!saveSubmittedPayload(merged)) {
      setSubmitError({
        title: '동의를 저장하지 못했습니다',
        message: '잠시 후 다시 시도해주세요. 반복되면 브라우저의 시크릿 모드를 꺼 주세요.',
      });
      return;
    }

    startTransition(() => {
      router.push('/processing');
    });
  }

  // 성인은 보호자 동의 제외 — "전체 동의" 표시를 진행 가능 조건(필수 항목)과 일치시킨다(Codex #65).
  const allChecked = checked.terms && checked.privacy && (!guardianRequired || checked.guardian);
  const canProceed = allRequiredMet();

  return (
    <RequireAuth>
    <RequireAdmissionsAccess>
    <>
      <PageHeader />
      <div className="w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">동의</h1>
          <StepIndicator current="consent" />
        </div>
        <p className="mb-6 text-ink-700">
          학생부 종합 전형 진단 서비스를 진행하려면 아래 {guardianRequired ? 3 : 2}가지 동의가
          모두 필요합니다. 한 가지라도 동의하지 않으면 다음 단계로 진행할 수 없습니다.
        </p>

        {sessionLost && (
          <div className="mb-4">
            <ErrorState
              title="로그인이 풀렸습니다"
              message="세션이 만료돼 연령 확인이 되지 않아요. 다시 로그인하면 원래 조건으로 돌아옵니다. (확인 전까지는 법정대리인 동의를 필수로 봅니다.)"
              tone="warning"
            />
          </div>
        )}

        {/* 연령 구간은 가입 생년월일 기반 권위값(읽기 전용) — 화면 자기신고로 보호자 동의를 우회할 수 없다. */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">만 14세 미만인가요?</p>
            <p className="mt-0.5 text-xs text-ink-500">
              만 14세 미만이라면 법정대리인 동의가 필수로 추가됩니다.
            </p>
          </div>
          <span className="rounded-md border border-ink-100 bg-ink-50 px-3 py-1.5 text-xs font-medium text-ink-700">
            {guardianRequired ? '만 14세 미만' : '만 14세 이상'}
          </span>
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
          <span className="text-xs text-ink-500">필수 {guardianRequired ? 3 : 2}개</span>
        </div>

        <section className="space-y-3">
          {items.map((item) => (
            <ConsentRow
              key={item.id}
              item={item}
              required={item.id !== 'guardian' || guardianRequired}
              dim={item.id === 'guardian' && !guardianRequired}
              checked={checked[item.id]}
              onChange={(v) => toggle(item.id, v)}
            />
          ))}
        </section>

        {submitError ? (
          <ErrorState
            title={submitError.title}
            message={submitError.message}
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
                if (guardianRequired && !checked.guardian) missing.push('법정대리인');
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
    </RequireAdmissionsAccess>
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
        본 서비스는 법정대리인 동의 절차와 생기부 보관·삭제 정책이 모두 가동된 이후에만
        실제 사용자 데이터를 받습니다. 생기부는 연령과 무관하게 민감정보로 다루며,
        보관 기간이 지나면 자동 삭제합니다.
      </p>
    </aside>
  );
}
