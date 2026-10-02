import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';
const state = vi.hoisted(() => ({ push: vi.fn(), next: null as string | null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }), useSearchParams: () => ({ get: () => state.next }) }));
vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => ({ status: 'authed', refresh: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({ auth: { login: vi.fn() } }));
afterEach(() => { cleanup(); state.push.mockClear(); state.next = null; });
describe('login destination', () => {
  it.each([null, 'https://external.invalid'])('uses the existing home for missing or unsafe next (%s)', async next => {
    state.next = next;
    render(<LoginPage />);
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/'));
  });
  it('preserves an explicit protected destination', async () => {
    state.next = '/result';
    render(<LoginPage />);
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/result'));
  });
});
