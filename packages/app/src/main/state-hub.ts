/**
 * Pushes are coalesced within a tick: several synchronous changes produce one
 * push per store per window, carrying the latest value. No Electron imports:
 * windows are `WindowSink`s.
 */
import { ErrorCode, FiddleError } from '../shared/errors';
import type { AppState, WindowState } from '../shared/stores';

export interface WindowSink {
  pushApp(state: AppState): void;
  pushWindow(state: WindowState): void;
}

export type AppPatch = Partial<Omit<AppState, 'rev'>>;
type WindowPatch = Partial<Omit<WindowState, 'rev' | 'windowId'>>;
export type WindowInit = Omit<WindowState, 'rev' | 'windowId'>;

/** `app` for an App change, otherwise the ID of the window that changed. */
export type ChangeListener = (
  change: { store: 'app' } | { store: 'window'; windowId: string },
) => void;

interface Entry {
  state: WindowState;
  sink: WindowSink;
}

export class StateHub {
  #app: AppState;
  readonly #windows = new Map<string, Entry>();
  #appDirty = false;
  readonly #dirtyWindows = new Set<string>();
  #flushScheduled = false;
  readonly #listeners = new Set<ChangeListener>();
  readonly #log: (error: unknown) => void;

  constructor(
    initialApp: Omit<AppState, 'rev'>,
    log: (error: unknown) => void = console.error,
  ) {
    this.#app = { ...initialApp, rev: 0 };
    this.#log = log;
  }

  get app(): AppState {
    return this.#app;
  }

  getWindow(windowId: string): WindowState | undefined {
    return this.#windows.get(windowId)?.state;
  }

  get windowIds(): string[] {
    return [...this.#windows.keys()];
  }

  registerWindow(windowId: string, init: WindowInit, sink: WindowSink): WindowState {
    if (this.#windows.has(windowId)) {
      throw new FiddleError(
        ErrorCode.conflict,
        `Window ${windowId} is already registered`,
      );
    }
    const state: WindowState = { ...init, windowId, rev: 0 };
    this.#windows.set(windowId, { state, sink });
    return state;
  }

  /** Called when the window's webContents is destroyed. Pending pushes are dropped. */
  unregisterWindow(windowId: string): void {
    this.#windows.delete(windowId);
    this.#dirtyWindows.delete(windowId);
  }

  /** Applies a change to `App` and returns the `rev` that includes it. */
  updateApp(patch: AppPatch): number {
    this.#app = { ...this.#app, ...patch, rev: this.#app.rev + 1 };
    this.#appDirty = true;
    this.#scheduleFlush();
    return this.#app.rev;
  }

  /** Applies a change to one window's `Window` and returns the `rev` that includes it. */
  updateWindow(windowId: string, patch: WindowPatch): number {
    const entry = this.#windows.get(windowId);
    if (!entry)
      throw new FiddleError(ErrorCode.notFound, `Window ${windowId} is not registered`);
    entry.state = { ...entry.state, ...patch, windowId, rev: entry.state.rev + 1 };
    this.#dirtyWindows.add(windowId);
    this.#scheduleFlush();
    return entry.state.rev;
  }

  /** Called after each flush, once per changed store. Returns an unsubscribe function. */
  onChange(listener: ChangeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #scheduleFlush(): void {
    if (this.#flushScheduled) return;
    this.#flushScheduled = true;
    queueMicrotask(() => this.#flush());
  }

  #flush(): void {
    this.#flushScheduled = false;
    const appDirty = this.#appDirty;
    const dirtyWindows = [...this.#dirtyWindows];
    this.#appDirty = false;
    this.#dirtyWindows.clear();

    if (appDirty) {
      for (const entry of this.#windows.values())
        this.#push(() => entry.sink.pushApp(this.#app));
    }
    for (const windowId of dirtyWindows) {
      const entry = this.#windows.get(windowId);
      if (entry) this.#push(() => entry.sink.pushWindow(entry.state));
    }

    if (appDirty) this.#notify({ store: 'app' });
    for (const windowId of dirtyWindows) this.#notify({ store: 'window', windowId });
  }

  #push(send: () => void): void {
    try {
      send();
    } catch (error) {
      // One broken window must not stop the others from getting the update.
      this.#log(error);
    }
  }

  #notify(change: Parameters<ChangeListener>[0]): void {
    for (const listener of this.#listeners) this.#push(() => listener(change));
  }
}
