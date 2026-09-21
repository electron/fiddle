import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  githubApi: {
    ReadClipboardGist: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
  },
  documentsApi: { LoadGist: vi.fn((_id: string, _sha: null) => Promise.resolve(1)) },
  loaded: undefined as { id: string } | undefined,
}));

vi.mock('../../../ipc/renderer', () => ({
  githubApi: mocks.githubApi,
  documentsApi: mocks.documentsApi,
}));
vi.mock('./state', () => ({ useLoadedGist: () => mocks.loaded }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
  }),
}));

import { OpenGistDialog } from './OpenGistDialog';

const LINK = 'https://gist.github.com/fiddle/8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const field = () =>
  screen.getByRole('textbox', { name: 'openLabel' }) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loaded = undefined;
  mocks.githubApi.ReadClipboardGist.mockResolvedValue(null);
  mocks.documentsApi.LoadGist.mockResolvedValue(1);
});

describe('OpenGistDialog', () => {
  it('offers the gist link on the clipboard, selected, and opens it', async () => {
    mocks.githubApi.ReadClipboardGist.mockResolvedValue(LINK);
    render(<OpenGistDialog onClose={vi.fn()} />);
    // The selection follows the value in an effect of its own.
    await waitFor(() =>
      expect([field().value, field().selectionStart, field().selectionEnd]).toEqual([
        LINK,
        0,
        LINK.length,
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: 'openSubmit' }));
    await waitFor(() =>
      expect(mocks.documentsApi.LoadGist).toHaveBeenCalledWith(LINK, null),
    );
  });

  it('leaves the field alone once something was typed', async () => {
    let paste: (text: string | null) => void = () => undefined;
    mocks.githubApi.ReadClipboardGist.mockReturnValue(
      new Promise((resolve) => (paste = resolve)),
    );
    render(<OpenGistDialog onClose={vi.fn()} />);
    fireEvent.change(field(), { target: { value: 'abc' } });
    await act(async () => paste(LINK));
    expect(field().value).toBe('abc');
  });

  it('stays empty when the clipboard holds no gist', async () => {
    render(<OpenGistDialog onClose={vi.fn()} />);
    await act(async () => undefined);
    expect(field().value).toBe('');
    expect(mocks.githubApi.ReadClipboardGist).toHaveBeenCalledTimes(1);
  });

  it('flags something that is not a gist once the field is left, and never sends it', () => {
    render(<OpenGistDialog onClose={vi.fn()} />);
    fireEvent.change(field(), { target: { value: 'not a gist' } });
    expect(screen.queryByText('openInvalid')).toBeNull();
    fireEvent.blur(field());
    expect(screen.getByText('openInvalid')).toBeTruthy();
    fireEvent.submit(field().closest('form')!);
    expect(mocks.documentsApi.LoadGist).not.toHaveBeenCalled();
  });

  it('opens the gist on Enter, and stays open saying why when it could not be loaded', async () => {
    mocks.documentsApi.LoadGist.mockRejectedValueOnce(new Error('rate limited'));
    const onClose = vi.fn();
    render(<OpenGistDialog onClose={onClose} />);
    fireEvent.change(field(), { target: { value: LINK } });
    fireEvent.submit(field().closest('form')!);
    expect(await screen.findByText('loadFailed rate limited')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.submit(field().closest('form')!);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.documentsApi.LoadGist).toHaveBeenLastCalledWith(LINK, null);
  });

  it('names the gist that is already open, and closes from Cancel', () => {
    mocks.loaded = { id: '8c5fc0c6a5153d49b5a4a56d3ed9da8f' };
    const onClose = vi.fn();
    render(<OpenGistDialog onClose={onClose} />);
    expect(screen.getByText(/^openCurrent https:\/\/gist\.github\.com\//)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
