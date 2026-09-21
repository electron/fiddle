import { EventEmitter } from 'node:events';
import fs from 'node:fs';

import { vi } from 'vitest';

import type { WindowInit } from '../state-hub';
import type { initDocuments } from './service';

type Deps = Parameters<typeof initDocuments>[0];

interface FakeDocumentsOptions {
  sessionRestore?: boolean;
  platform?: Deps['platform'];
  /** Members added to (or replacing those of) the fake state hub. */
  hub?: object;
  versions?: object;
  github?: object;
  npm?: object;
  /** Runs after the window is recorded in the returned map. */
  onCreateWindow?: (windowId: string, init: WindowInit) => Promise<void>;
  onDocsExampleLoaded?: (windowId: string) => void;
}

/** A BrowserWindow with the members the documents service uses. */
export function fakeWindow(visible = true) {
  return Object.assign(new EventEmitter(), {
    focus: vi.fn(),
    restore: vi.fn(),
    isMinimized: (): boolean => false,
    isVisible: () => visible,
    setTitle: vi.fn(),
    setDocumentEdited: vi.fn(),
    close: vi.fn(),
  });
}
export type FakeWindow = ReturnType<typeof fakeWindow>;

/** Initialises the documents service with a state hub that keeps window state in the returned map. */
export function initFakeDocuments(
  documents: { initDocuments: typeof initDocuments },
  options: FakeDocumentsOptions = {},
): Map<string, Record<string, unknown>> {
  const windows = new Map<string, Record<string, unknown>>();
  documents.initDocuments({
    hub: {
      app: { settings: { sessionRestore: options.sessionRestore ?? false } },
      getWindow: (id: string) => windows.get(id),
      updateWindow: (id: string, patch: Record<string, unknown>) => {
        windows.set(id, { ...windows.get(id), ...patch });
        return 1;
      },
      onChange: () => () => undefined,
      ...options.hub,
    } as unknown as Deps['hub'],
    platform: options.platform ?? 'linux',
    versions: {
      releases: () => [],
      release: () => undefined,
      localBuild: () => undefined,
      electronVersions: {},
      ...options.versions,
    } as unknown as Deps['versions'],
    github: {
      client: () => undefined,
      whenReady: async () => undefined,
      ...options.github,
    } as unknown as Deps['github'],
    npm: {
      packument: async () => ({ versions: {} }),
      ...options.npm,
    } as unknown as Deps['npm'],
    createWindow: async (windowId, init) => {
      windows.set(windowId, { ...init });
      await options.onCreateWindow?.(windowId, init);
    },
    ...(options.onDocsExampleLoaded
      ? { onDocsExampleLoaded: options.onDocsExampleLoaded }
      : {}),
  });
  return windows;
}

/**
 * Writes the drafts and session the service still has on a timer and waits for every JSON store,
 * then removes `dir`. A write that landed after the removal would recreate the folder or make
 * `rmSync` fail on a busy file.
 */
export async function flushAndRemove(dir: string): Promise<void> {
  try {
    (await import('./service')).flushDraftsAndSession();
    await (await import('../persistence/json-store')).flushAll();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
}
