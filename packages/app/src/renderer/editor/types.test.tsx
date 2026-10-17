/** Tests loading Electron and Node typings into Monaco, now and when main says they changed. */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EditorTypes } from '../../shared/stores';

const mocks = vi.hoisted(() => ({
  setExtraLibs: vi.fn((_libs: { content: string; filePath: string }[]) => undefined),
  GetTypes: vi.fn<() => Promise<EditorTypes | null>>(),
  onTypesChanged: vi.fn((listener: () => void) => {
    mocks.changed = listener;
    return mocks.unsubscribe;
  }),
  changed: undefined as (() => void) | undefined,
  unsubscribe: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('./monaco', () => ({
  monaco: { typescript: { javascriptDefaults: { setExtraLibs: mocks.setExtraLibs } } },
}));
vi.mock('../../ipc/renderer', () => ({
  versionsApi: { GetTypes: mocks.GetTypes, onTypesChanged: mocks.onTypesChanged },
}));
vi.mock('../features/about/log', () => ({ log: { error: mocks.logError } }));

import { applyEditorTypes, useEditorTypes } from './types';

const types = (version: string): EditorTypes => ({
  version,
  electron: `// electron ${version}`,
  node: { 'fs.d.ts': '// fs', 'path.d.ts': '// path' },
});
const libPaths = () => mocks.setExtraLibs.mock.lastCall?.[0].map((lib) => lib.filePath);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.changed = undefined;
});

describe('applyEditorTypes', () => {
  it('registers electron.d.ts and the Node files where Monaco resolves those modules', () => {
    applyEditorTypes(types('44.0.0'));
    expect(libPaths()).toEqual([
      'file:///node_modules/electron/index.d.ts',
      'file:///node_modules/@types/node/fs.d.ts',
      'file:///node_modules/@types/node/path.d.ts',
    ]);
    expect(mocks.setExtraLibs.mock.lastCall?.[0][0]?.content).toBe('// electron 44.0.0');
  });

  it('clears the libraries when there are no types, and skips a missing electron.d.ts', () => {
    applyEditorTypes(null);
    expect(libPaths()).toEqual([]);
    applyEditorTypes({ ...types('44.0.0'), electron: null });
    expect(libPaths()).toEqual([
      'file:///node_modules/@types/node/fs.d.ts',
      'file:///node_modules/@types/node/path.d.ts',
    ]);
  });
});

describe('useEditorTypes', () => {
  it('loads the types on mount and again when main says they changed, and stops listening on unmount', async () => {
    mocks.GetTypes.mockResolvedValue(types('44.0.0'));
    const view = renderHook(() => useEditorTypes());
    await act(async () => undefined);
    expect(mocks.setExtraLibs).toHaveBeenCalledTimes(1);

    mocks.GetTypes.mockResolvedValue(types('45.0.0'));
    await act(async () => mocks.changed?.());
    expect(mocks.setExtraLibs.mock.lastCall?.[0][0]?.content).toBe('// electron 45.0.0');

    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('applies only the newest answer when an older request resolves late', async () => {
    let late: (types: EditorTypes) => void = () => undefined;
    mocks.GetTypes.mockReturnValueOnce(new Promise((resolve) => (late = resolve)));
    mocks.GetTypes.mockResolvedValue(types('45.0.0'));
    renderHook(() => useEditorTypes());
    await act(async () => mocks.changed?.());
    await act(async () => late(types('44.0.0')));
    expect(mocks.setExtraLibs).toHaveBeenCalledTimes(1);
    expect(mocks.setExtraLibs.mock.lastCall?.[0][0]?.content).toBe('// electron 45.0.0');
  });

  it('logs a failed load and keeps the editor usable without types', async () => {
    mocks.GetTypes.mockRejectedValue(new Error('offline'));
    renderHook(() => useEditorTypes());
    await act(async () => undefined);
    expect(mocks.logError).toHaveBeenCalledWith(
      'loading editor types failed',
      expect.any(Error),
    );
    expect(mocks.setExtraLibs).not.toHaveBeenCalled();
  });

  it('does without types where the Versions interface is not bound', () => {
    mocks.onTypesChanged.mockImplementationOnce(() => {
      throw new Error('EIPC interface Versions is not available here');
    });
    renderHook(() => useEditorTypes()).unmount();
    expect(mocks.logError).toHaveBeenCalledWith(
      'editor types unavailable',
      expect.any(Error),
    );
    expect(mocks.GetTypes).not.toHaveBeenCalled();
  });
});
