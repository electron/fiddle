/** Tests the toolbar's publish button: publishing signed in or out, the loaded-gist menu, and the gist commands. */
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings, type Settings } from '../../../shared/settings';

const mocks = vi.hoisted(() => ({
  login: 'octocat' as string | undefined,
  settings: {} as Partial<Settings>,
  gist: undefined as { gistId: string; gistOwner?: string } | undefined,
  commands: [] as Array<(id: string) => void>,
  githubApi: {
    TakeNotice: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
    Update: vi.fn(() => Promise.resolve({ id: 'abc' })),
    Delete: vi.fn(() => Promise.resolve()),
    CopyShareLink: vi.fn((_id: string) => Promise.resolve()),
  },
  settingsApi: {
    SetSetting: vi.fn((_key: string, _value: unknown) => Promise.resolve(1)),
  },
  showToast: vi.fn(),
  confirmDialog: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../../ipc/renderer', () => ({
  githubApi: mocks.githubApi,
  settingsApi: mocks.settingsApi,
  windowApi: {
    onCommand: (listener: (id: string) => void) => {
      mocks.commands.push(listener);
      return () => undefined;
    },
  },
}));
vi.mock('../../state', () => ({
  useAppState: () => ({
    platform: 'linux',
    githubLogin: mocks.login,
    settings: { ...defaultSettings, ...mocks.settings },
  }),
  useWindowState: () => ({
    fiddle: { source: { origin: 'local', trusted: true, ...mocks.gist } },
  }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../ui')>()),
  showToast: mocks.showToast,
  confirmDialog: mocks.confirmDialog,
}));
// The dialogs have tests of their own: here only which one opens matters.
vi.mock('./GistDialogs', () => ({ GistDialogs: () => null }));

import { PublishButton } from './PublishButton';
import { showGistDialog, useGistDialog } from './state';

const forward = (id: string) =>
  act(() => mocks.commands.forEach((listener) => listener(id)));

function renderButton() {
  const dialog = renderHook(() => useGistDialog());
  render(<PublishButton />);
  return { dialog: () => dialog.result.current };
}

/** Opens the loaded-gist menu and picks an item. */
async function choose(
  name: string,
  role: 'menuitem' | 'menuitemradio' = 'menuitem',
): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'publishButton' }));
  fireEvent.click(await screen.findByRole(role, { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.login = 'octocat';
  mocks.settings = {};
  mocks.gist = undefined;
  mocks.commands.length = 0;
  mocks.githubApi.TakeNotice.mockResolvedValue(null);
  mocks.confirmDialog.mockResolvedValue(true);
  showGistDialog(null);
});

describe('PublishButton without a gist', () => {
  it('opens the publish form when signed in', () => {
    const { dialog } = renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'publishButton' }));
    expect(dialog()).toEqual({ kind: 'publish' });
  });

  it('asks a signed-out user to sign in first, then opens the publish form', () => {
    mocks.login = undefined;
    const { dialog } = renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'publishButton' }));
    const signIn = dialog();
    expect(signIn?.kind).toBe('sign-in');
    act(() => (signIn as { then: () => void }).then());
    expect(dialog()).toEqual({ kind: 'publish' });
  });

  it('answers the gist commands and ignores the rest', () => {
    const { dialog } = renderButton();
    forward('file.save');
    expect(dialog()).toBeNull();
    forward('gist.publish');
    expect(dialog()).toEqual({ kind: 'publish' });
    forward('gist.open');
    expect(dialog()).toEqual({ kind: 'open' });
    forward('gist.history');
    expect(dialog()).toEqual({ kind: 'history' });
    forward('gist.signIn');
    expect(dialog()).toEqual({ kind: 'sign-in' });
  });

  it('warns when the saved token could not be decrypted', async () => {
    mocks.githubApi.TakeNotice.mockResolvedValue('decrypt-failed');
    renderButton();
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'warning', title: 'noticeDecryptFailed' }),
      ),
    );
  });

  it('names the compact icon button for screen readers', () => {
    render(<PublishButton compact />);
    expect(screen.getByRole('button', { name: 'publishButton' }).textContent).toBe('');
  });
});

describe('PublishButton with a gist loaded', () => {
  beforeEach(() => {
    mocks.gist = { gistId: 'abc', gistOwner: 'OctoCat' };
  });

  it('updates the gist and offers its link', async () => {
    renderButton();
    await choose('menuUpdate');
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'success', title: 'updated' }),
      ),
    );
    expect(mocks.githubApi.Update).toHaveBeenCalledTimes(1);
  });

  it('signs a signed-out user in before updating', async () => {
    mocks.login = undefined;
    const { dialog } = renderButton();
    await choose('menuUpdate');
    expect(dialog()?.kind).toBe('sign-in');
    expect(mocks.githubApi.Update).not.toHaveBeenCalled();
    await act(async () => (dialog() as { then: () => void }).then());
    expect(mocks.githubApi.Update).toHaveBeenCalledTimes(1);
  });

  it('copies the share link, and opens the publish, history and open dialogs', async () => {
    const { dialog } = renderButton();
    await choose('menuCopyLink');
    expect(mocks.githubApi.CopyShareLink).toHaveBeenCalledWith('abc');
    await choose('menuPublishNew');
    expect(dialog()).toEqual({ kind: 'publish' });
    await choose('menuHistory');
    expect(dialog()).toEqual({ kind: 'history' });
    await choose('openGist');
    expect(dialog()).toEqual({ kind: 'open' });
  });

  it('saves the chosen visibility as a setting', async () => {
    renderButton();
    await choose('visibilityPublic', 'menuitemradio');
    expect(mocks.settingsApi.SetSetting).toHaveBeenCalledWith('gistVisibility', 'public');

    mocks.settings = { gistVisibility: 'public' };
    renderButton();
    fireEvent.click(screen.getAllByRole('button', { name: 'publishButton' })[1]!);
    expect(
      (
        await screen.findByRole('menuitemradio', { name: 'visibilityPublic' })
      ).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'visibilitySecret' }));
    expect(mocks.settingsApi.SetSetting).toHaveBeenLastCalledWith(
      'gistVisibility',
      'secret',
    );
  });

  it('deletes the gist only once the user confirms', async () => {
    mocks.confirmDialog.mockResolvedValueOnce(false);
    renderButton();
    await choose('menuDelete');
    await waitFor(() => expect(mocks.confirmDialog).toHaveBeenCalledTimes(1));
    expect(mocks.githubApi.Delete).not.toHaveBeenCalled();

    await choose('menuDelete');
    await waitFor(() => expect(mocks.githubApi.Delete).toHaveBeenCalledTimes(1));
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', title: 'deleted' }),
    );
  });

  it('says why the gist could not be deleted', async () => {
    mocks.githubApi.Delete.mockRejectedValueOnce(new Error('GitHub responded 404'));
    renderButton();
    await choose('menuDelete');
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'error',
          title: 'deleteFailed',
          description: 'GitHub responded 404',
        }),
        expect.anything(),
      ),
    );
  });

  it("leaves updating and deleting someone else's gist disabled", async () => {
    mocks.gist = { gistId: 'abc', gistOwner: 'someone-else' };
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'publishButton' }));
    const item = async (name: string) => await screen.findByRole('menuitem', { name });
    expect((await item('menuUpdate')).getAttribute('aria-disabled')).toBe('true');
    expect((await item('menuDelete')).getAttribute('aria-disabled')).toBe('true');
    expect((await item('menuCopyLink')).getAttribute('aria-disabled')).toBeNull();
  });

  it('drops the history entry when the setting turns it off', async () => {
    mocks.settings = { gistShowHistory: false };
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'publishButton' }));
    await screen.findByRole('menuitem', { name: 'menuUpdate' });
    expect(screen.queryByRole('menuitem', { name: 'menuHistory' })).toBeNull();
  });
});
