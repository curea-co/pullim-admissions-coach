'use client';

// 건의하기 창구 — 우하단 플로팅 버튼 + 모달을 한 컴포넌트에 담은 **자립형**.
// 통합 담당이 셸의 `floating` 슬롯에 <FeedbackWidget /> 하나만 꽂으면 된다.
//
// 채택 시안: FAB 02 "원형 아이콘 · 호버 확장" — 쉴 때는 52px 원, 호버·포커스에서 알약으로 펼쳐지며
// 라벨을 보여 준다. 평소 점유 면적을 원 하나로 줄이면서 커서를 얹으면 라벨이 돌아온다.
//
// 의존성 원칙: 이 앱에는 Radix 도 lucide 도 없다. 아이콘은 인라인 SVG, 모달·포커스 트랩·스크롤
// 잠금은 직접 구현한다(components/shell/command-search.tsx 와 같은 규칙).

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FEEDBACK_CONTENT_MAX,
  feedbackCategoryEnum,
  feedbackCategoryLabel,
  type FeedbackCategory,
} from '@pullim/shared';
import { isFeedbackEnabled, submitFeedback } from '@/lib/feedback';
import { cn } from '@/lib/utils';

/** 내용이 비었을 때 — 다그치지 않고 최소 단위를 알려 준다. */
const EMPTY_MESSAGE = '내용이 비어 있어요. 어느 화면에서 무엇이 불편했는지 한 줄만 적어도 괜찮아요.';

type Phase = 'form' | 'sending' | 'done';
/** 입력 오류(사용자가 고칠 수 있음)와 전송 오류(서버 쪽)는 포커스 이동 지점이 다르다. */
type FieldError = { kind: 'input' | 'send'; message: string };

export function FeedbackWidget() {
  // 플래그는 렌더 시점에 함수로 읽는다 — 모듈 상수로 굳히면 테스트의 stubEnv 가 먹지 않는다.
  const enabled = isFeedbackEnabled();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [content, setContent] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<FieldError | null>(null);

  const fabRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const doneTitleRef = useRef<HTMLHeadingElement>(null);
  /** 전송 세대 — 닫은 뒤 늦게 도착한 응답이 화면을 바꾸지 않게 한다. */
  const sendSeq = useRef(0);

  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const categoryId = `${uid}-category`;
  const contentId = `${uid}-content`;
  const hintId = `${uid}-hint`;
  const countId = `${uid}-count`;
  const errorId = `${uid}-error`;

  const sending = phase === 'sending';

  const openDialog = () => {
    setPhase('form');
    setError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    // 진행 중 전송이 있으면 그 결과는 버린다(요청 자체는 이미 나갔다 — 취소하지는 않는다).
    sendSeq.current += 1;
    setOpen(false);
    setPhase('form');
    setError(null);
    setContent('');
    setCategory('general');
    // 포커스 복귀는 즉시 — 모달이 사라지며 포커스가 <body> 로 떨어지면 키보드 사용자는
    // 문서 처음부터 다시 Tab 을 눌러야 한다.
    fabRef.current?.focus();
  };

  // Escape 는 document 에서 듣는다 — 백드롭을 클릭하면 포커스가 모달 밖으로 나가서
  // 모달 onKeyDown 만으로는 잡지 못한다(command-search 와 같은 이유).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeDialog();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 열린 동안 배경 스크롤 잠금. 원래 값을 복원해 다른 곳에서 건 잠금과 싸우지 않는다.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 열리면 첫 컨트롤(카테고리)로 포커스.
  useEffect(() => {
    if (!open) return;
    selectRef.current?.focus();
  }, [open]);

  // 완료 화면은 제목으로 포커스 — 화면이 통째로 바뀌었다는 사실이 읽혀야 한다.
  useEffect(() => {
    if (open && phase === 'done') doneTitleRef.current?.focus();
  }, [open, phase]);

  // 오류가 뜨면 포커스를 옮긴다. 입력 오류는 고칠 곳(입력칸)으로, 전송 오류는 메시지로.
  // (전송 중에는 버튼이 aria-disabled 라 포커스가 사라지지 않지만, 무엇이 바뀌었는지는 알려야 한다.)
  useEffect(() => {
    if (!error) return;
    if (error.kind === 'input') textareaRef.current?.focus();
    else errorRef.current?.focus();
  }, [error]);

  const handleSend = async () => {
    if (sending) return;
    const trimmed = content.trim();
    if (!trimmed) {
      setError({ kind: 'input', message: EMPTY_MESSAGE });
      return;
    }
    setError(null);
    setPhase('sending');
    const seq = (sendSeq.current += 1);
    const result = await submitFeedback({ category, content: trimmed });
    if (seq !== sendSeq.current) return; // 닫혔거나 다른 전송이 시작됐다
    if (result.ok) {
      setPhase('done');
      return;
    }
    // 전달되지 않았으면 완료 화면으로 넘기지 않는다 — 실패는 실패로 보여 준다(§6 가짜 상태 금지).
    setPhase('form');
    setError({ kind: 'send', message: result.message });
  };

  // 포커스 트랩 — Tab 이 모달 밖(배경 페이지)으로 새어 나가지 않게 순환시킨다.
  const onDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const list = Array.from(nodes ?? []).filter(
      (el) => !el.hasAttribute('disabled') && el.tabIndex >= 0,
    );
    if (list.length === 0) {
      e.preventDefault();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!enabled) return null;

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => (open ? closeDialog() : openDialog())}
        aria-label="건의하기"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          // 히트 영역은 **확장 폭 기준**으로 고정한다(데스크톱 136×52). 버튼 상자가 호버마다
          // 커졌다 작아지면 가장자리에서 hover 가 풀려 깜빡인다. 안쪽 알약만 움직인다.
          // fb-fab: 전역 포커스 링 제거(app/globals.css) — 링은 안쪽 알약에 2겹으로 다시 그린다.
          'fb-fab group fixed right-4 z-[65] flex h-12 w-12 items-center justify-end outline-none',
          // 탭바 위 14px. 탭바 높이는 62px + safe-area 다(components/ui/os-tabbar.tsx) — 리터럴
          // 76px 로 박으면 홈 인디케이터 기기에서 탭바를 20px 덮어 탭이 먹지 않는다.
          'bottom-[calc(var(--tabbar-h)_+_env(safe-area-inset-bottom)_+_14px)]',
          // 탭바는 z-70. FAB 은 그 아래에 둬 어떤 경우에도 탭을 가리지 않는다(z-65).
          // ≥921px 는 탭바가 없다 — 우하단 24px(+ 가로 태블릿의 safe-area).
          'min-[921px]:bottom-[calc(24px_+_env(safe-area-inset-bottom))] min-[921px]:right-6 min-[921px]:h-[52px] min-[921px]:w-[136px]',
        )}
      >
        <span
          className={cn(
            'inline-flex h-12 shrink-0 items-center whitespace-nowrap rounded-full bg-[var(--color-action-primary)] px-3 text-white',
            'shadow-[0_6px_20px_rgba(3,98,218,.30),0_1px_3px_rgba(0,0,0,.12)]',
            'transition-[background-color,box-shadow] duration-200',
            'group-hover:bg-[var(--color-action-primary-hover)]',
            'min-[921px]:h-[52px] min-[921px]:px-3.5',
            // 포커스 링 2겹(흰 안쪽 + 어두운 바깥). 전역 포커스 링은 브랜드색이라 브랜드로 채운
            // 이 버튼 위에서는 보이지 않는다.
            'group-focus-visible:shadow-[0_0_0_3px_#fff,0_0_0_5px_var(--color-gray-950),0_6px_20px_rgba(3,98,218,.30)]',
          )}
        >
          <BulbIcon />
          {/* 라벨은 grid 트랙 0fr→1fr 로 여닫는다 — width 를 직접 애니메이션하면 매 프레임
              레이아웃을 유발하고 내용 폭을 하드코딩해야 해서 문구가 바뀌면 깨진다.
              모바일(≤920px)에서는 호버가 없으므로 펼치지 않는다(원형 유지). */}
          <span
            aria-hidden="true"
            className={cn(
              'fb-fab-label grid grid-cols-[0fr] opacity-0',
              'min-[921px]:group-hover:grid-cols-[1fr] min-[921px]:group-hover:opacity-100',
              'group-focus-visible:grid-cols-[1fr] group-focus-visible:opacity-100',
            )}
          >
            <span className="overflow-hidden pl-2 text-[13.5px] font-semibold tracking-[-0.011em]">
              건의하기
            </span>
          </span>
        </span>
      </button>

      {/* 포털로 <body> 에 붙인다 — 헤더가 backdrop-blur 를 걸고 있어 fixed 자식의 컨테이닝
          블록이 되어버린다(모달이 헤더 안에 갇힌다). command-search 와 같은 처리. */}
      {open &&
        createPortal(
          <div
            data-testid="feedback-overlay"
            className="fb-fade fixed inset-0 z-[100] flex items-end justify-center bg-[var(--surface-overlay)] min-[561px]:items-center min-[561px]:p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeDialog();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              aria-busy={sending || undefined}
              onKeyDown={onDialogKeyDown}
              // 모바일은 바텀시트(한 손 조작에서 액션이 엄지 사정권), 561px 이상은 가운데 모달.
              // 등장 모션은 그 두 형태가 달라 CSS 쪽(.fb-dialog)에서 미디어쿼리로 가른다.
              className="fb-dialog flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius-2xl)] border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)] min-[561px]:max-h-full min-[561px]:max-w-[480px] min-[561px]:rounded-[var(--radius-xl)]"
            >
              <span
                aria-hidden="true"
                className="mx-auto mt-2 block h-1 w-9 rounded-full bg-[var(--border-default)] min-[561px]:hidden"
              />

              <div className="relative border-b border-[var(--border-default)] px-5 pb-3 pt-[18px]">
                <h2
                  id={titleId}
                  className="mb-1 text-[18px] font-bold leading-[1.45] tracking-[-0.022em] text-[var(--text-primary)]"
                >
                  건의하기
                </h2>
                <p id={descId} className="pr-9 text-[13px] leading-[1.6] text-[var(--text-tertiary)]">
                  서비스 개선을 위한 의견을 보내주세요. 건의하신 내용은 운영팀에서 검토해요.
                </p>
                {/* 전송 중에도 닫기는 살려 둔다 — 사용자를 모달에 가두지 않는다. */}
                <button
                  type="button"
                  onClick={closeDialog}
                  aria-label="건의하기 창 닫기"
                  className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors duration-150 hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="17"
                    height="17"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="m6 6 12 12" />
                    <path d="m18 6-12 12" />
                  </svg>
                </button>
              </div>

              {sending && (
                <div aria-hidden="true" className="h-0.5 overflow-hidden bg-brand-100">
                  <i className="fb-progress block h-full w-2/5 bg-[var(--color-action-primary)]" />
                </div>
              )}

              {phase === 'done' ? (
                <div className="px-5 pb-6 pt-7 text-center">
                  <div className="fb-ok mx-auto mb-3.5 grid h-[52px] w-[52px] place-items-center rounded-full bg-[var(--color-success-50)] text-[var(--color-success-600)]">
                    <svg
                      viewBox="0 0 24 24"
                      width="26"
                      height="26"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path className="fb-ok-draw" d="m4.5 12.5 5 5 10-11" pathLength={1} />
                    </svg>
                  </div>
                  <h3
                    ref={doneTitleRef}
                    tabIndex={-1}
                    className="mb-1.5 text-[17px] font-bold tracking-[-0.022em] text-[var(--text-primary)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-action-primary)]"
                  >
                    건의를 접수했어요
                  </h3>
                  {/* 접수번호는 표시하지 않는다 — 발급하는 식별자가 없으므로 가짜 번호를 보여 주지 않는다. */}
                  <p className="mx-auto max-w-[34ch] text-[13px] leading-[1.65] text-[var(--text-tertiary)]">
                    <span className="block">운영팀이 들어온 순서대로 확인합니다.</span>
                    <span className="block">확인까지 며칠 걸릴 수 있어요.</span>
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto px-5 py-[18px]">
                  <div>
                    <label
                      htmlFor={categoryId}
                      className="mb-2 block text-[13px] font-semibold text-[var(--text-secondary)]"
                    >
                      카테고리
                    </label>
                    {/* 네이티브 select — 모바일에서 OS 기본 피커가 뜨고, 라벨·키보드·스크린리더
                        지원이 브라우저 기본으로 따라온다(직접 만든 드롭다운은 그걸 전부 다시 짜야 한다). */}
                    <div className="relative">
                      <select
                        ref={selectRef}
                        id={categoryId}
                        value={category}
                        disabled={sending}
                        onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                        className="block w-full cursor-pointer appearance-none rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white py-[11px] pl-3 pr-10 text-base leading-[1.5] tracking-[-0.011em] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-gray-400)] focus:border-[var(--color-action-primary)] focus:shadow-[0_0_0_3px_rgba(3,98,218,.14)] disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-tertiary)]"
                      >
                        {feedbackCategoryEnum.options.map((value) => (
                          <option key={value} value={value}>
                            {feedbackCategoryLabel[value]}
                          </option>
                        ))}
                      </select>
                      {/* appearance-none 으로 지운 화살표를 되돌린다. 클릭은 select 로 흘려보낸다. */}
                      <svg
                        viewBox="0 0 24 24"
                        width="17"
                        height="17"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>

                  <div className="mt-[18px]">
                    <label
                      htmlFor={contentId}
                      className="mb-2 block text-[13px] font-semibold text-[var(--text-secondary)]"
                    >
                      내용
                      <span aria-hidden="true" className="ml-0.5 text-[var(--color-danger-600)]">
                        *
                      </span>
                      <span className="sr-only">(필수)</span>
                    </label>
                    <textarea
                      ref={textareaRef}
                      id={contentId}
                      required
                      maxLength={FEEDBACK_CONTENT_MAX}
                      disabled={sending}
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        // 입력을 시작하면 오류 표시를 거둔다 — 고치는 중에 계속 붉게 남아 있지 않게.
                        if (error) setError(null);
                      }}
                      aria-invalid={error?.kind === 'input' ? true : undefined}
                      aria-describedby={[hintId, countId, error ? errorId : null]
                        .filter(Boolean)
                        .join(' ')}
                      placeholder="서비스 이용 중 불편하거나 개선이 필요한 점을 자유롭게 작성해주세요."
                      // 16px(text-base) — iOS Safari 는 16px 미만 입력에 포커스하면 화면을 확대한다.
                      className={cn(
                        'block min-h-[130px] w-full resize-y rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white px-3 py-3 text-base leading-[1.65] tracking-[-0.011em] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-150',
                        'placeholder:text-[var(--color-gray-400)] focus:border-[var(--color-action-primary)] focus:shadow-[0_0_0_3px_rgba(3,98,218,.14)]',
                        'disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-tertiary)]',
                        error?.kind === 'input' &&
                          'border-[var(--color-danger-600)] focus:border-[var(--color-danger-600)] focus:shadow-[0_0_0_3px_rgba(225,29,72,.14)]',
                      )}
                    />
                    <div className="mt-1.5 flex justify-between gap-3">
                      <span id={hintId} className="text-xs leading-[1.5] text-[var(--text-tertiary)]">
                        어느 화면에서 무슨 일이 있었는지 함께 적어 주시면 더 빨리 확인할 수 있어요.
                      </span>
                      <span
                        id={countId}
                        className="whitespace-nowrap text-xs tabular-nums text-[var(--color-gray-400)]"
                      >
                        {content.length} / {FEEDBACK_CONTENT_MAX}
                      </span>
                    </div>

                    {error && (
                      <p
                        ref={errorRef}
                        id={errorId}
                        role="alert"
                        tabIndex={-1}
                        className="mt-2 flex items-start gap-[7px] rounded-[var(--radius-lg)] border border-[rgba(225,29,72,.22)] bg-[var(--color-danger-50)] px-3 py-2.5 text-[13px] font-medium leading-[1.55] text-[var(--color-danger-900)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-danger-600)]"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="15"
                          height="15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="mt-[3px] shrink-0"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7.5v5" />
                          <path d="M12 16.5h.01" />
                        </svg>
                        <span>{error.message}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-[var(--border-default)] bg-[var(--surface-raised)] px-5 py-3.5 pb-[max(14px,env(safe-area-inset-bottom))] min-[561px]:pb-3.5">
                {phase === 'done' ? (
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-action-primary)] px-[18px] text-sm font-semibold tracking-[-0.01em] text-white shadow-[var(--shadow-md)] transition-colors duration-150 hover:bg-[var(--color-action-primary-hover)] min-[561px]:flex-none"
                  >
                    닫기
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={closeDialog}
                      disabled={sending}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white px-[18px] text-sm font-semibold tracking-[-0.01em] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-sunken)] disabled:cursor-not-allowed disabled:opacity-60 min-[561px]:flex-none"
                    >
                      취소
                    </button>
                    {/* disabled 대신 aria-disabled — 전송을 시작한 순간 버튼이 disabled 가 되면
                        포커스가 <body> 로 떨어져 포커스 트랩 밖으로 나간다. */}
                    <button
                      type="button"
                      onClick={handleSend}
                      aria-disabled={sending || undefined}
                      className={cn(
                        'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--color-action-primary)] px-[18px] text-sm font-semibold tracking-[-0.01em] text-white shadow-[var(--shadow-md)] transition-colors duration-150 min-[561px]:flex-none',
                        sending ? 'cursor-not-allowed opacity-60' : 'hover:bg-[var(--color-action-primary-hover)]',
                      )}
                    >
                      {sending && (
                        <span
                          aria-hidden="true"
                          className="h-[15px] w-[15px] shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        />
                      )}
                      {sending ? '보내는 중…' : '보내기'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function BulbIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[22px] w-[22px] shrink-0 min-[921px]:h-6 min-[921px]:w-6"
    >
      <path d="M9 18h6" />
      <path d="M10 21.5h4" />
      <path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6v.1h6v-.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5Z" />
    </svg>
  );
}
