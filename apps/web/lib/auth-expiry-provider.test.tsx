// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../components/auth/auth-provider';
import { api } from './api';
import { auth } from './auth';
import { setUserScope } from './result';

vi.mock('./auth', () => ({ auth: { getMe: vi.fn(), logout: vi.fn() } }));
vi.mock('./result', () => ({ setUserScope: vi.fn() }));
vi.mock('./admissions-api', () => ({ clearAdmissionsAccessCache: vi.fn() }));
function Probe() { const { status } = useAuth(); return <span>{status}</span>; }
let notify: () => void;
beforeEach(() => {
  vi.spyOn(api, 'subscribeExpired').mockImplementation((listener) => { notify = listener; return vi.fn(); });
  vi.mocked(auth.getMe).mockResolvedValue({ id: 'synthetic' } as Awaited<ReturnType<typeof auth.getMe>>);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
it('clears member UI and result scope on confirmed expiry', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('authed');
  act(() => notify());
  expect(screen.getByText('guest')).toBeTruthy();
  expect(setUserScope).toHaveBeenLastCalledWith(null);
});
it('ignores late getMe completion after expiry', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof auth.getMe>>) => void;
  vi.mocked(auth.getMe).mockReturnValue(new Promise((r) => { resolve = r; }));
  render(<AuthProvider><Probe /></AuthProvider>);
  act(() => notify());
  await act(async () => resolve({ id: 'old' } as Awaited<ReturnType<typeof auth.getMe>>));
  expect(screen.getByText('guest')).toBeTruthy();
  expect(setUserScope).toHaveBeenLastCalledWith(null);
});
