import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  githubApi: {
    ReadClipboardGist: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
  },
  documentsApi: { LoadGist: vi.fn(() => Promise.resolve(1)) },
}));

vi.mock('../../../ipc/renderer', () => ({
  githubApi: mocks.githubApi,
  documentsApi: mocks.documentsApi,
}));
vi.mock('./state', () => ({ useLoadedGist: () => undefined }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { OpenGistDialog } from './OpenGistDialog';

const LINK = 'https://gist.github.com/fiddle/8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const field = () =>
  screen.getByRole('textbox', { name: 'openLabel' }) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.githubApi.ReadClipboardGist.mockResolvedValue(null);
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
});
