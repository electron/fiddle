import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  versionsApi: { SetVersion: vi.fn() },
  documentsApi: { SetActiveFile: vi.fn() },
  showToast: vi.fn(),
}));

vi.mock('../../ipc/renderer', () => ({
  versionsApi: mocks.versionsApi,
  documentsApi: mocks.documentsApi,
}));
vi.mock('../../ui', () => ({ showToast: mocks.showToast }));

import type { WindowState } from '../../shared/stores';
import { setActiveFile, setVersionRef, useWithPending } from './window-state';

const base = {
  rev: 1,
  view: 'editor',
  layout: { panes: [] },
  fiddle: {
    versionRef: { kind: 'release', version: '44.0.0' },
    activeFile: 'main.js',
    files: [
      { name: 'main.js', visible: true },
      { name: 'view.js', visible: false },
    ],
  },
} as unknown as WindowState;

const seen: Array<WindowState | null> = [];
const shown = () => seen.at(-1) ?? null;
function Reader({ state }: { state: WindowState | null }) {
  seen.push(useWithPending(state));
  return null;
}

afterEach(() => {
  vi.clearAllMocks();
  seen.length = 0;
});

describe('window state changes', () => {
  it('shows a picked version before main has answered, and reverts it when main refuses', async () => {
    render(<Reader state={base} />);
    let reject!: (error: Error) => void;
    mocks.versionsApi.SetVersion.mockReturnValueOnce(
      new Promise((_resolve, fail) => (reject = fail)),
    );
    void act(
      () =>
        void setVersionRef(
          { kind: 'release', version: '43.0.0' },
          'Could not change the version',
        ),
    );
    await vi.waitFor(() =>
      expect(shown()?.fiddle.versionRef).toEqual({ kind: 'release', version: '43.0.0' }),
    );
    await act(async () => reject(new Error('offline')));
    expect(shown()?.fiddle.versionRef).toEqual({ kind: 'release', version: '44.0.0' });
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Could not change the version',
        description: 'offline',
      }),
    );
  });

  it('opens a hidden file and makes it active until the store catches up', async () => {
    const view = render(<Reader state={base} />);
    mocks.documentsApi.SetActiveFile.mockResolvedValueOnce(2);
    await act(() => setActiveFile('view.js', 'failed'));
    expect(shown()?.fiddle.activeFile).toBe('view.js');
    expect(shown()?.fiddle.files.find((file) => file.name === 'view.js')?.visible).toBe(
      true,
    );
    const next = structuredClone(base);
    next.rev = 2;
    next.fiddle.activeFile = 'view.js';
    view.rerender(<Reader state={next} />);
    expect(shown()).toBe(next);
  });
});
