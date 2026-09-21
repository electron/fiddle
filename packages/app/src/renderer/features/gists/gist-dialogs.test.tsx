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
    SignInFromClipboard:
      vi.fn<
        (allowPlaintext: boolean) => Promise<{ login: string; persisted: boolean }>
      >(),
    Publish: vi.fn<(description: string, isPublic: boolean) => Promise<{ id: string }>>(),
    Update: vi.fn<() => Promise<{ id: string }>>(),
    CopyShareLink: vi.fn<(id: string) => Promise<void>>(() => Promise.resolve()),
    GetHistory: vi.fn<() => Promise<History>>(),
    ReadClipboardGist: vi.fn(() => Promise.resolve(null)),
  },
  documentsApi: {
    LoadGist: vi.fn<(id: string, sha: string | null) => Promise<number>>(),
  },
  settingsApi: { SetSetting: vi.fn<(key: string, value: unknown) => Promise<number>>() },
  showToast: vi.fn(),
}));

interface History {
  id: string;
  activeSha?: string;
  revisions: {
    sha: string;
    date: string;
    additions: number;
    deletions: number;
    n: number;
  }[];
}

vi.mock('../../../ipc/renderer', () => ({
  githubApi: mocks.githubApi,
  documentsApi: mocks.documentsApi,
  settingsApi: mocks.settingsApi,
}));
vi.mock('../../state', () => ({
  useAppState: () => ({}),
  useWindowState: () => null,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('../../../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../ui')>()),
  showToast: mocks.showToast,
}));

import { copyShareLink, reportGistError, updateGist, type GistT } from './actions';
import { GistDialogs } from './GistDialogs';
import { HistoryDialog } from './HistoryDialog';
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

describe('updateGist', () => {
  it('offers to copy the link of the gist it updated', async () => {
    mocks.githubApi.Update.mockResolvedValue({ id: 'abc' });
    await updateGist(t);
    const toast = mocks.showToast.mock.calls[0]![0] as {
      title: string;
      actionLabel: string;
      onAction: () => void;
    };
    expect(toast).toMatchObject({
      tone: 'success',
      title: 'updated',
      actionLabel: 'copyLink',
    });
    toast.onAction();
    expect(mocks.githubApi.CopyShareLink).toHaveBeenCalledWith('abc');
  });

  it('retries after a sign-in when GitHub no longer accepts the token', async () => {
    mocks.githubApi.Update.mockRejectedValueOnce(
      new FiddleError(ErrorCode.unauthorized, 'Bad credentials', { status: 401 }),
    );
    mocks.githubApi.Update.mockResolvedValue({ id: 'abc' });
    const view = openDialog();
    await act(() => updateGist(t));
    expect(view.result.current?.kind).toBe('sign-in');
    await act(async () => (view.result.current as { then: () => void }).then());
    expect(mocks.githubApi.Update).toHaveBeenCalledTimes(2);
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'updated' }),
    );
  });
});

describe('copyShareLink', () => {
  it('says so when the link was copied, and why when it could not be', async () => {
    copyShareLink(t, 'abc');
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({
        tone: 'success',
        title: 'linkCopied',
      }),
    );
    mocks.githubApi.CopyShareLink.mockRejectedValueOnce(new Error('clipboard busy'));
    copyShareLink(t, 'abc');
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({
        tone: 'error',
        title: 'clipboard busy',
      }),
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

  it('signs in with the token on the clipboard when the field is left empty, on Enter too', async () => {
    mocks.githubApi.HasClipboardToken.mockResolvedValue(true);
    mocks.githubApi.SignInFromClipboard.mockResolvedValue({
      login: 'octocat',
      persisted: false,
    });
    const onClose = vi.fn();
    render(<SignInDialog onClose={onClose} />);
    await screen.findByText('signInClipboardHint');
    fireEvent.submit(screen.getByLabelText('signInTokenLabel').closest('form')!);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.githubApi.SignInFromClipboard).toHaveBeenCalledWith(false);
    expect(mocks.githubApi.SignIn).not.toHaveBeenCalled();
    // Not persisted: the toast says the sign-in lasts for this session.
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', description: 'signedInSession' }),
    );
  });

  it.each([
    [
      'a token in the wrong format',
      { reason: 'bad-format' },
      ErrorCode.invalidArgument,
      'signInErrorFormat',
    ],
    [
      'a token GitHub rejects',
      { reason: 'invalid-token' },
      ErrorCode.unauthorized,
      'signInErrorInvalid',
    ],
    [
      'a token without the gist scope',
      { reason: 'missing-scope' },
      ErrorCode.forbidden,
      'signInErrorScope',
    ],
    ['GitHub being unreachable', undefined, ErrorCode.network, 'signInErrorNetwork'],
    [
      'anything else',
      undefined,
      ErrorCode.internal,
      'signInErrorOther {"message":"boom"}',
    ],
  ])(
    'explains %s under the field and stays open',
    async (_case, details, code, message) => {
      mocks.githubApi.SignIn.mockRejectedValue(new FiddleError(code, 'boom', details));
      const onClose = vi.fn();
      render(<SignInDialog onClose={onClose} />);
      signIn();
      expect(await screen.findByText(message)).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      // Typing clears the message.
      fireEvent.change(screen.getByLabelText('signInTokenLabel'), {
        target: { value: 'ghp_other' },
      });
      expect(screen.queryByText(message)).toBeNull();
    },
  );

  it('stores the token in plain text only when the user asks, where the keyring is weak', async () => {
    mocks.githubApi.GetCredentialStorage.mockResolvedValue('weak');
    mocks.githubApi.SignIn.mockResolvedValue({ login: 'octocat', persisted: true });
    render(<SignInDialog onClose={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText('signInRemember'));
    signIn();
    await waitFor(() =>
      expect(mocks.githubApi.SignIn).toHaveBeenCalledWith('ghp_token', true),
    );
  });

  it('says the sign-in only lasts for the session where nothing can store the token', async () => {
    mocks.githubApi.GetCredentialStorage.mockResolvedValue('unavailable');
    render(<SignInDialog onClose={vi.fn()} />);
    expect(await screen.findByText('signInSessionOnly')).toBeTruthy();
    expect(screen.queryByLabelText('signInRemember')).toBeNull();
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

  it('publishes on Enter in the description, and closes on Escape', async () => {
    mocks.githubApi.Publish.mockResolvedValue({ id: 'abc' });
    const onClose = vi.fn();
    render(<PublishDialog onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    fill('Enter does it');
    fireEvent.submit(screen.getByLabelText('publishDescriptionLabel').closest('form')!);
    await waitFor(() =>
      expect(mocks.githubApi.Publish).toHaveBeenCalledWith('Enter does it', false),
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

  it('stays open and reports the error when GitHub refuses before a gist exists', async () => {
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

  it('closes and reports the error when the gist was created but its files could not be uploaded', async () => {
    mocks.githubApi.Publish.mockRejectedValue(
      new FiddleError(ErrorCode.unavailable, 'GitHub responded 500', { gistId: 'abc' }),
    );
    const onClose = vi.fn();
    render(<PublishDialog onClose={onClose} />);
    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error', title: 'publishFailed' }),
      expect.anything(),
    );
  });
});

describe('HistoryDialog', () => {
  const history: History = {
    id: 'abc',
    activeSha: 'b'.repeat(40),
    revisions: [
      {
        sha: 'a'.repeat(40),
        date: '2026-01-01T00:00:00Z',
        additions: 3,
        deletions: 0,
        n: 0,
      },
      {
        sha: 'b'.repeat(40),
        date: '2026-01-02T00:00:00Z',
        additions: 1,
        deletions: 1,
        n: 1,
      },
      {
        sha: 'c'.repeat(40),
        date: '2026-01-03T00:00:00Z',
        additions: 2,
        deletions: 5,
        n: 2,
      },
    ],
  };
  const rows = () => screen.getAllByRole('option').map((row) => row.textContent);

  it('lists the revisions newest first, marks the loaded one, and loads the one chosen', async () => {
    mocks.githubApi.GetHistory.mockResolvedValue(history);
    mocks.documentsApi.LoadGist.mockResolvedValue(1);
    const onClose = vi.fn();
    render(<HistoryDialog onClose={onClose} />);
    await screen.findAllByRole('option');
    expect(screen.getByRole('listbox', { name: 'historyListLabel' })).toBeTruthy();
    expect(rows()).toEqual([
      expect.stringContaining('historyRevision {"n":2}'),
      expect.stringContaining('historyRevision {"n":1}'),
      expect.stringContaining('historyCreated'),
    ]);
    expect(rows()[1]).toContain('historyActive');
    expect(rows()[0]).not.toContain('historyActive');

    fireEvent.click(screen.getByRole('option', { name: /historyCreated/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.documentsApi.LoadGist).toHaveBeenCalledWith('abc', 'a'.repeat(40));
  });

  it('stays open and says why when a revision could not be loaded', async () => {
    mocks.githubApi.GetHistory.mockResolvedValue(history);
    mocks.documentsApi.LoadGist.mockRejectedValue(
      new FiddleError(ErrorCode.notFound, 'gone'),
    );
    const onClose = vi.fn();
    render(<HistoryDialog onClose={onClose} />);
    fireEvent.click(await screen.findByRole('option', { name: /historyCreated/ }));
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({
        tone: 'error',
        title: 'loadFailed {"message":"gone"}',
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says when the gist has no revisions, or its history could not be read', async () => {
    mocks.githubApi.GetHistory.mockResolvedValue({ id: 'abc', revisions: [] });
    const view = render(<HistoryDialog onClose={vi.fn()} />);
    expect(await screen.findByText('historyEmpty')).toBeTruthy();
    view.unmount();

    mocks.githubApi.GetHistory.mockRejectedValue(
      new FiddleError(ErrorCode.network, 'offline'),
    );
    render(<HistoryDialog onClose={vi.fn()} />);
    expect(await screen.findByText('historyFailed {"message":"offline"}')).toBeTruthy();
  });

  it('closes from the footer or on Escape', async () => {
    mocks.githubApi.GetHistory.mockResolvedValue(history);
    const onClose = vi.fn();
    render(<HistoryDialog onClose={onClose} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'close' }).at(-1)!);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});

describe('GistDialogs', () => {
  it('mounts the dialog that was asked for, and unmounts it when it closes', async () => {
    mocks.githubApi.GetHistory.mockResolvedValue({ id: 'abc', revisions: [] });
    render(<GistDialogs />);
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => showGistDialog({ kind: 'publish' }));
    expect(screen.getByRole('dialog', { name: 'publishTitle' })).toBeTruthy();
    act(() => showGistDialog({ kind: 'open' }));
    expect(screen.getByRole('dialog', { name: 'openTitle' })).toBeTruthy();
    act(() => showGistDialog({ kind: 'history' }));
    expect(screen.getByRole('dialog', { name: 'historyTitle' })).toBeTruthy();
    act(() => showGistDialog({ kind: 'sign-in' }));
    expect(screen.getByRole('dialog', { name: 'signInTitle' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
