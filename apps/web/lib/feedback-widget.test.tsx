import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeedbackWidget } from '../components/feedback/feedback-widget';

// 건의하기 위젯 회귀 고정. 수동 확인으로 놓치기 쉬운 것들만 못박는다 — 플래그 노출, 포털 모달의
// 열고 닫기·포커스 복귀, **실패했을 때 완료 화면으로 넘어가지 않는 것**.
//
// 이 파일이 components/ 가 아니라 lib/ 에 있는 이유: vitest include 가 `lib/**` 와 `app/**`
// 뿐이라(apps/web/vitest.config.ts) components/ 아래 테스트는 수집되지 않는다.

const fetchMock = vi.fn();

const fab = () => screen.getByRole('button', { name: '건의하기' });
const dialog = () => screen.getByRole('dialog');
const categorySelect = () => screen.getByLabelText('카테고리');
const contentInput = () => screen.getByLabelText(/내용/);
const sendButton = () => screen.getByRole('button', { name: '보내기' });
const sentBody = () =>
  JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as {
    category: string;
    content: string;
  };

function open() {
  fireEvent.click(fab());
  return dialog();
}

async function fillAndSend(text = '탭을 바꾸면 스크롤이 맨 위로 올라가요.') {
  fireEvent.change(contentInput(), { target: { value: text } });
  fireEvent.click(sendButton());
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_FEEDBACK_ENABLED', 'true');
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  document.body.style.overflow = '';
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('FeedbackWidget — 노출 플래그', () => {
  it('플래그가 꺼져 있으면 아무것도 렌더하지 않는다(기본값)', () => {
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_ENABLED', '');
    const { container } = render(<FeedbackWidget />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: '건의하기' })).not.toBeInTheDocument();
  });

  it('플래그가 켜지면 FAB 을 렌더한다', () => {
    render(<FeedbackWidget />);
    const button = fab();
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('FeedbackWidget — 겹침 방지(탭바)', () => {
  // 화면 없이도 회귀를 잡을 수 있는 두 가지만 클래스로 못박는다.
  //  ① 하단 오프셋에 safe-area 가 들어가 있는가 — 리터럴 76px 이면 홈 인디케이터 기기에서
  //     탭바(62px + safe-area)를 덮어 탭이 먹지 않는다.
  //  ② 탭바(z-70)보다 아래인가.
  it('하단 오프셋이 탭바 높이 + safe-area 로 계산된다(리터럴 금지)', () => {
    render(<FeedbackWidget />);
    const cls = fab().className;
    expect(cls).toContain('bottom-[calc(var(--tabbar-h)_+_env(safe-area-inset-bottom)_+_14px)]');
    expect(cls).not.toMatch(/bottom-\[76px\]/);
  });

  it('탭바(z-70)보다 아래인 z-65 에 둔다', () => {
    render(<FeedbackWidget />);
    expect(fab().className).toContain('z-[65]');
  });
});

describe('FeedbackWidget — 열기·닫기', () => {
  it('클릭하면 모달이 열리고 첫 컨트롤(카테고리)로 포커스가 간다', async () => {
    render(<FeedbackWidget />);
    open();
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(fab()).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(categorySelect()).toHaveFocus());
  });

  it.each([
    ['Esc', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['백드롭 클릭', () => fireEvent.click(screen.getByTestId('feedback-overlay'))],
    ['취소', () => fireEvent.click(screen.getByRole('button', { name: '취소' }))],
    ['닫기(X)', () => fireEvent.click(screen.getByRole('button', { name: '건의하기 창 닫기' }))],
  ])('%s 로 닫히고 포커스가 FAB 으로 돌아온다', async (_label, act) => {
    render(<FeedbackWidget />);
    open();
    act();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fab()).toHaveAttribute('aria-expanded', 'false');
    expect(fab()).toHaveFocus();
  });

  it('닫으면 작성 중이던 내용이 남지 않는다', async () => {
    render(<FeedbackWidget />);
    open();
    fireEvent.change(contentInput(), { target: { value: '작성 중' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    open();
    expect(contentInput()).toHaveValue('');
  });
});

describe('FeedbackWidget — 포커스 트랩', () => {
  // jsdom 은 Tab 으로 포커스를 옮기지 않는다 — 트랩이 **직접** 옮기는지만 확인한다
  // (트랩이 없으면 preventDefault·focus 가 없어 아래 단언이 깨진다).
  it('마지막 컨트롤에서 Tab → 첫 컨트롤로 돌아온다', () => {
    render(<FeedbackWidget />);
    const node = open();
    sendButton().focus();
    fireEvent.keyDown(node, { key: 'Tab' });
    expect(screen.getByRole('button', { name: '건의하기 창 닫기' })).toHaveFocus();
  });

  it('첫 컨트롤에서 Shift+Tab → 마지막 컨트롤로 간다', () => {
    render(<FeedbackWidget />);
    const node = open();
    screen.getByRole('button', { name: '건의하기 창 닫기' }).focus();
    fireEvent.keyDown(node, { key: 'Tab', shiftKey: true });
    expect(sendButton()).toHaveFocus();
  });
});

describe('FeedbackWidget — 입력 검증', () => {
  it('빈 내용으로 보내면 오류를 띄우고 전송하지 않는다', async () => {
    render(<FeedbackWidget />);
    open();
    fireEvent.click(sendButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('내용이 비어 있어요');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(contentInput()).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(contentInput()).toHaveFocus());
    // 완료 화면으로 넘어가지 않는다.
    expect(screen.queryByText('건의를 접수했어요')).not.toBeInTheDocument();
  });

  it('공백만 입력해도 전송하지 않는다', async () => {
    render(<FeedbackWidget />);
    open();
    fireEvent.change(contentInput(), { target: { value: '    ' } });
    fireEvent.click(sendButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('입력을 시작하면 오류 표시가 사라진다', async () => {
    render(<FeedbackWidget />);
    open();
    fireEvent.click(sendButton());
    await screen.findByRole('alert');

    fireEvent.change(contentInput(), { target: { value: 'ㄱ' } });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(contentInput()).not.toHaveAttribute('aria-invalid');
  });
});

describe('FeedbackWidget — 전송', () => {
  it('선택한 카테고리가 payload 에 실린다', async () => {
    render(<FeedbackWidget />);
    open();
    fireEvent.change(categorySelect(), { target: { value: 'bug' } });
    await fillAndSend();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody()).toEqual({
      category: 'bug',
      content: '탭을 바꾸면 스크롤이 맨 위로 올라가요.',
    });
  });

  it('기본 카테고리는 일반 문의', async () => {
    render(<FeedbackWidget />);
    open();
    await fillAndSend();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody().category).toBe('general');
  });

  it('성공하면 완료 화면 — 버튼은 "닫기" 하나', async () => {
    render(<FeedbackWidget />);
    open();
    await fillAndSend();

    expect(await screen.findByText('건의를 접수했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보내기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '취소' })).not.toBeInTheDocument();
    // 발급하지 않는 접수번호는 보여 주지 않는다(가짜 상태 금지).
    expect(screen.queryByText(/접수번호/)).not.toBeInTheDocument();
    expect(screen.queryByText(/FB-/)).not.toBeInTheDocument();
  });

  it('완료 화면에서는 제목으로 포커스가 이동한다', async () => {
    render(<FeedbackWidget />);
    open();
    await fillAndSend();
    const title = await screen.findByText('건의를 접수했어요');
    await waitFor(() => expect(title).toHaveFocus());
  });

  it('전송 중에도 닫기(X)는 살아 있다 — 사용자를 모달에 가두지 않는다', async () => {
    let release: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (release = resolve)));

    render(<FeedbackWidget />);
    open();
    await fillAndSend();

    const close = await screen.findByRole('button', { name: '건의하기 창 닫기' });
    expect(close).toBeEnabled();
    expect(screen.getByRole('button', { name: /보내는 중/ })).toBeInTheDocument();

    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // 늦게 도착한 응답이 닫힌 모달을 완료 화면으로 되살리지 않는다.
    release(new Response(JSON.stringify({ ok: true }), { status: 202 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('건의를 접수했어요')).not.toBeInTheDocument();
  });
});

describe('FeedbackWidget — 전송 실패', () => {
  it('서버 501(수집처 미설정) → 완료 화면으로 넘어가지 않고 오류를 보여 준다', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 501 }));
    render(<FeedbackWidget />);
    open();
    await fillAndSend();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('연결되어 있지 않아');
    expect(screen.queryByText('건의를 접수했어요')).not.toBeInTheDocument();
    // 다시 시도할 수 있어야 한다 — 폼과 작성한 내용이 그대로 남는다.
    expect(screen.getByRole('button', { name: '보내기' })).toBeInTheDocument();
    expect(contentInput()).toHaveValue('탭을 바꾸면 스크롤이 맨 위로 올라가요.');
  });

  it('네트워크 실패 → 완료 화면으로 넘어가지 않고 오류를 보여 준다', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<FeedbackWidget />);
    open();
    await fillAndSend();

    expect(await screen.findByRole('alert')).toHaveTextContent('네트워크');
    expect(screen.queryByText('건의를 접수했어요')).not.toBeInTheDocument();
  });

  it('전송 오류 메시지로 포커스가 이동한다(전송 중 사라진 포커스 복구)', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 502 }));
    render(<FeedbackWidget />);
    open();
    await fillAndSend();
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('실패 후 다시 보내면 재전송한다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 502 }));
    fetchMock.mockResolvedValueOnce(new Response('', { status: 202 }));
    render(<FeedbackWidget />);
    open();
    await fillAndSend();
    await screen.findByRole('alert');

    fireEvent.click(sendButton());
    expect(await screen.findByText('건의를 접수했어요')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('FeedbackWidget — 카피 가드레일(§6)', () => {
  it('모달 어디에도 "정답·합격·대본" 표현이 없다', () => {
    render(<FeedbackWidget />);
    open();
    expect(dialog().textContent ?? '').not.toMatch(/정답|합격|대본/);
  });
});
