import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 배너가 **거짓을 말하지 않는지** 고정한다.
//
// dev 배포에서 이 배너가 "mock 데이터 시연 전용. 실 사용자 데이터를 수집·저장하지 않습니다" 라고
// 떠 있었는데, 같은 환경이 pullim-api 에 배선돼 제출한 생기부를 실제로 저장하고 있었다
// (QA 2026-09-20). 생기부는 미성년자 민감정보라(정의 §6.3) 이 문장은 틀리면 안 된다.
//
// 이제 문구는 선언이 아니라 `NEXT_PUBLIC_PULLIM_API` 에서 나온다 — lib/admissions-api.ts 가
// 실제로 호출에 쓰는 바로 그 값이라, 배너와 코드가 어긋날 수 없다.
//
// 모듈 최상위에서 env 를 읽으므로 케이스마다 resetModules + 동적 import 한다.

const ORIGINAL = { ...process.env };

async function renderBanner() {
  vi.resetModules();
  const { DemoBanner } = await import('../components/demo-banner');
  render(<DemoBanner />);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('DemoBanner', () => {
  it('데모 플래그가 없으면 아무것도 렌더하지 않는다', async () => {
    delete process.env.NEXT_PUBLIC_DEMO;
    process.env.NEXT_PUBLIC_PULLIM_API = 'https://dev-api.pullim.ai';
    await renderBanner();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('백엔드가 붙어 있으면 저장된다고 말한다 — "저장하지 않습니다" 라고 하지 않는다', async () => {
    process.env.NEXT_PUBLIC_DEMO = 'true';
    process.env.NEXT_PUBLIC_PULLIM_API = 'https://dev-api.pullim.ai';
    await renderBanner();

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('서버에 저장되니');
    expect(note.textContent).not.toMatch(/저장하지 않습니다/);
    expect(note.textContent).not.toMatch(/수집·저장하지 않습니다/);
  });

  it('백엔드가 없으면 저장되지 않는다고 말한다', async () => {
    process.env.NEXT_PUBLIC_DEMO = 'true';
    delete process.env.NEXT_PUBLIC_PULLIM_API;
    await renderBanner();

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('백엔드 미연결');
    expect(note).toHaveTextContent('저장되지 않습니다');
  });

  it('빈 문자열은 미연결로 본다', async () => {
    process.env.NEXT_PUBLIC_DEMO = 'true';
    process.env.NEXT_PUBLIC_PULLIM_API = '';
    await renderBanner();
    expect(screen.getByRole('note')).toHaveTextContent('백엔드 미연결');
  });
});
