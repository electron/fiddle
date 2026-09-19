import type { WindowInit } from '../state-hub';
import type { initDocuments } from './service';

type Deps = Parameters<typeof initDocuments>[0];

interface FakeDocumentsOptions {
  sessionRestore?: boolean;
  /** Members added to (or replacing those of) the fake state hub. */
  hub?: object;
  versions?: object;
  github?: object;
  npm?: object;
  /** Runs after the window is recorded in the returned map. */
  onCreateWindow?: (windowId: string, init: WindowInit) => Promise<void>;
}

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
    platform: 'linux',
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
  });
  return windows;
}
