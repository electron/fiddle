import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode, FiddleError } from '../../../shared/errors';

const mocks = vi.hoisted(() => ({
  githubApi: {
    HasClipboardToken: vi.fn(() => Promise.resolve(false)),
    GetCredentialStorage: vi.fn(() => Promise.resolve('encrypted')),
    SignIn:
      vi.fn<
        (
          token: string,
          allowPlaintext: boolean,
        ) => Promise<{ login: string; persisted: boolean }>
      >(),
    SignInFromClipboard: vi.fn(),
    Publish: vi.fn<(description: string, isPublic: boolean) => Promise<{ id: string }>>(),
    OpenNewTokenPage: vi.fn(),
  },
  settingsApi: { SetSetting: vi.fn<(key: string, value: unknown) => Promise<number>>() },
  showToast: vi.fn(),
}));

vi.mock('../../../ipc/renderer', () => ({
  githubApi: mocks.githubApi,
  settingsApi: mocks.settingsApi,
}));
vi.mock('../../state', () => ({
  useAppState: () => undefined,
  useWindowState: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../ui')>()),
  showToast: mocks.showToast,
}));

import { reportGistError, type GistT } from './actions';
import { PublishDialog } from './PublishDialog';
import { SignInDialog } from './SignInDialog';
import { closeGistDialog, showGistDialog, useGistDialog, type GistDialog } from './state';

const t = ((key: string) => key) as unknown as GistT;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.githubApi.HasClipboardToken.mockResolvedValue(false);
  mocks.githubApi.GetCredentialStorage.mockResolvedValue('encrypted');
  showGistDialog(null);
});

const openDialog = () => renderHook(() => useGistDialog());

describe('closeGistDialog', () => {
  it('leaves a newer dialog open when an older one closes late', () => {
    const publish: GistDialog = { kind: 'publish' };
    const open: GistDialog = { kind: 'open' };
    const view = openDialog();
    act(() => showGistDialog(publish));
    act(() => showGistDialog(open));
    act(() => closeGistDialog(publish));
    expect(view.result.current).toBe(open);
  });
});

describe('reportGistError', () => {
  it.each([
    [
      'GitHub rejects the token',
      new FiddleError(ErrorCode.unauthorized, 'GitHub responded 401: Bad credentials', {
        status: 401,
      }),
    ],
    [
      'the user is signed out',
      new FiddleError(ErrorCode.unauthorized, 'Sign in to GitHub first', {
        reason: 'signed-out',
      }),
    ],
  ])('asks for a sign-in, then retries, when %s', (_case, error) => {
    const retry = vi.fn();
    const view = openDialog();
    act(() => reportGistError(t, 'update', error, retry));
    expect(view.result.current).toEqual({ kind: 'sign-in', then: retry });
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it('shows other errors as a toast', () => {
    const view = openDialog();
    act(() =>
      reportGistError(
        t,
        'update',
        new FiddleError(ErrorCode.notFound, 'Not Found'),
        vi.fn(),
      ),
    );
    expect(view.result.current).toBeNull();
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error', title: 'updateFailed' }),
      expect.anything(),
    );
  });
});

describe('SignInDialog', () => {
  const signIn = () => {
    fireEvent.change(screen.getByLabelText('signInTokenLabel'), {
      target: { value: 'ghp_token' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'signInSubmit' }));
  };

  it('closes and then runs its follow-up after a successful sign-in', async () => {
    const calls: string[] = [];
    mocks.githubApi.SignIn.mockResolvedValue({ login: 'octocat', persisted: true });
    render(
      <SignInDialog
        onClose={() => calls.push('close')}
        onSignedIn={() => calls.push('then')}
      />,
    );
    signIn();
    await waitFor(() => expect(calls).toEqual(['close', 'then']));
  });

  it('skips the follow-up when the dialog was cancelled while signing in', async () => {
    let finish: (value: { login: string; persisted: boolean }) => void = () => undefined;
    mocks.githubApi.SignIn.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const onClose = vi.fn();
    const onSignedIn = vi.fn();
    const view = render(<SignInDialog onClose={onClose} onSignedIn={onSignedIn} />);
    signIn();
    await waitFor(() => expect(mocks.githubApi.SignIn).toHaveBeenCalled());
    view.unmount();
    await act(async () => finish({ login: 'octocat', persisted: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});

describe('PublishDialog', () => {
  const fill = (description: string) =>
    fireEvent.change(screen.getByLabelText('publishDescriptionLabel'), {
      target: { value: description },
    });
  const submit = () =>
    fireEvent.click(screen.getByRole('button', { name: 'publishSubmit' }));

  it('publishes the trimmed description with the chosen visibility, then closes and offers the link', async () => {
    mocks.githubApi.Publish.mockResolvedValue({ id: 'abc' });
    const onClose = vi.fn();
    render(<PublishDialog onClose={onClose} />);
    fill('  My fiddle ');
    fireEvent.click(screen.getByLabelText('visibilityPublic'));
    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.githubApi.Publish).toHaveBeenCalledWith('My fiddle', true);
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', title: 'published' }),
    );
  });

  it('does not publish a blank or over-long description', () => {
    render(<PublishDialog onClose={vi.fn()} />);
    fill('   ');
    expect(
      (screen.getByRole('button', { name: 'publishSubmit' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fill('x'.repeat(257));
    expect(
      (screen.getByRole('button', { name: 'publishSubmit' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(mocks.githubApi.Publish).not.toHaveBeenCalled();
  });

  it('stays open and reports the error when GitHub refuses', async () => {
    mocks.githubApi.Publish.mockRejectedValue(
      new FiddleError(ErrorCode.forbidden, 'GitHub responded 403'),
    );
    const onClose = vi.fn();
    render(<PublishDialog onClose={onClose} />);
    submit();

    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: 'publishFailed' }),
        expect.anything(),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'publishSubmit' })).toBeTruthy();
  });
});
