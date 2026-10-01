import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SubmitPage from '../app/submit/page';

// 제출 화면의 식별정보 가림 규칙(2026-09-29 확정) 회귀 고정.
// (1) PDF 추출본은 서비스 안에서 고칠 수 없다 — 읽기 전용 미리보기 + 가리기/보이기 토글(기본 가리기).
// (2) 텍스트 탭은 원문 그대로 편집하고, 가려질 구간만 하이라이트로 알린다.
// (3) 제출은 두 방식 모두 탐지된 식별정보를 등급과 관계없이 전부 가린 본문으로 나간다.

const SAMPLE =
  '이름: 김민준\n학교: 서울한빛고등학교\n연락처: 010-1234-5678\n담임 박지현 선생님의 지도로 발표를 준비함.';

const saved: unknown[] = [];

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/auth/require-admissions-access', () => ({
  RequireAdmissionsAccess: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/page-header', () => ({ PageHeader: () => null }));
vi.mock('@/lib/pdf', () => ({
  validatePdfFile: () => ({ ok: true }),
  extractPdfText: () => ({
    promise: Promise.resolve({ ok: true, text: SAMPLE, pages: 1, sizeBytes: 1024 }),
    cancel: () => {},
  }),
}));
vi.mock('@/lib/submitted-payload', () => ({
  saveSubmittedPayload: (p: unknown) => {
    saved.push(p);
    return true;
  },
}));
vi.mock('@/lib/submitted-profile', () => ({ saveSubmittedProfile: () => {} }));

type SavedRecord = { record: { text: string; maskingApplied: boolean; maskedFields: string[] } };
const lastRecord = () => (saved.at(-1) as SavedRecord).record;

async function uploadPdf(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(['%PDF'], 'record.pdf', { type: 'application/pdf' })] },
  });
  await screen.findByText('추출된 본문');
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /동의 단계로/ }));
}

describe('제출 화면 — 식별정보 가림', () => {
  beforeEach(() => {
    saved.length = 0;
  });

  it('PDF: 추출본은 편집할 수 없고 기본으로 가린 모습을 보여 준다', async () => {
    const { container } = render(<SubmitPage />);
    await uploadPdf(container);

    const preview = screen.getByLabelText('추출된 본문');
    expect(preview.tagName).not.toBe('TEXTAREA');
    expect(preview).toHaveTextContent('[이름]');
    expect(preview).toHaveTextContent('[전화]');
    expect(preview).not.toHaveTextContent('김민준');
    expect(screen.getByRole('button', { name: '가리기' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('PDF: 보이기를 누르면 원문이 보이지만 제출은 가린 본문이다', async () => {
    const { container } = render(<SubmitPage />);
    await uploadPdf(container);

    fireEvent.click(screen.getByRole('button', { name: '보이기' }));
    expect(screen.getByLabelText('추출된 본문')).toHaveTextContent('김민준');

    submit();
    expect(lastRecord().text).not.toContain('김민준');
    expect(lastRecord().text).not.toContain('010-1234-5678');
    expect(lastRecord().text).toContain('[이름]');
    expect(lastRecord().maskingApplied).toBe(true);
  });

  it('PDF 추출본은 텍스트 탭으로 넘어가지 않는다(편집 우회 차단)', async () => {
    const { container } = render(<SubmitPage />);
    await uploadPdf(container);

    fireEvent.click(screen.getByRole('tab', { name: '텍스트 붙여넣기' }));
    expect(screen.getByRole('textbox', { name: '생기부 본문' })).toHaveValue('');
  });

  it('텍스트: 입력칸은 원문을 유지하고, 가려질 구간이 있으면 안내한다', async () => {
    render(<SubmitPage />);
    fireEvent.click(screen.getByRole('tab', { name: '텍스트 붙여넣기' }));
    const box = screen.getByRole('textbox', { name: '생기부 본문' });
    fireEvent.change(box, { target: { value: SAMPLE } });

    expect(box).toHaveValue(SAMPLE);
    await screen.findByText('표시된 텍스트는 가려져서 업로드돼요.');
  });

  it('텍스트: 이름·교사(warn 등급)도 확인 절차 없이 전부 가려서 제출한다', async () => {
    render(<SubmitPage />);
    fireEvent.click(screen.getByRole('tab', { name: '텍스트 붙여넣기' }));
    fireEvent.change(screen.getByRole('textbox', { name: '생기부 본문' }), {
      target: { value: SAMPLE },
    });

    submit();
    await waitFor(() => expect(saved).toHaveLength(1));
    const rec = lastRecord();
    for (const raw of ['김민준', '서울한빛고등학교', '010-1234-5678', '박지현']) {
      expect(rec.text).not.toContain(raw);
    }
    expect(rec.maskedFields).toEqual(
      expect.arrayContaining(['student_name', 'school_name', 'phone', 'teacher_name'])
    );
  });

  it('식별정보가 없으면 안내가 없다', async () => {
    render(<SubmitPage />);
    fireEvent.click(screen.getByRole('tab', { name: '텍스트 붙여넣기' }));
    fireEvent.change(screen.getByRole('textbox', { name: '생기부 본문' }), {
      target: { value: '진로 탐색에서 센서와 데이터 처리 원리를 조사함.' },
    });
    await new Promise((r) => setTimeout(r, 350));
    expect(screen.queryByText('표시된 텍스트는 가려져서 업로드돼요.')).not.toBeInTheDocument();
  });
});
