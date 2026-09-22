// Newline-delimited JSON over the socket named by `ELECTRON_FIDDLE_DRIVER_SOCKET`:
// `{ id, method, params }` requests, `{ id, ok, result | error }` responses.
// Also loaded by the plain-Node clients (e2e/driver.ts, tools/driver.ts): no imports.

/** A name or text: an exact string, or a regular expression. */
export type TextMatcher = string | { regex: string; flags?: string };

/** A window: its index in creation order, or its `windowId`. Default: the focused window, else the first. */
export type WindowRef = number | string;

/** Finds elements in the accessibility tree. Every query waits up to `timeout` ms (default 5000). */
export interface Query {
  /** Chromium accessibility role: `button`, `heading`, `textbox`, `menuitem`, `tab`, `StaticText`, ... */
  role?: string;
  /** Accessible name. A string matches exactly (after trimming). */
  name?: TextMatcher;
  /** Visible text: a string matches any text node containing it. */
  text?: TextMatcher;
  /** Picks one of several matches. Without it, actions need exactly one match. */
  nth?: number;
  timeout?: number;
  window?: WindowRef;
}

export interface ElementInfo {
  role: string;
  name: string;
  /** Center and size in CSS pixels, relative to the window's content. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** e.g. `disabled`, `focused`, `checked`, `expanded`, `selected`. */
  states: string[];
}

export interface WindowInfo {
  index: number;
  windowId: string | undefined;
  title: string;
  visible: boolean;
  focused: boolean;
  url: string;
}

export type DialogKind = 'messageBox' | 'open' | 'save';

/** A scripted answer for the next dialog of a kind: a messageBox `button` (by label) or `response`; `filePaths` or `filePath`; or `canceled`. */
export type DialogResponse =
  | { response?: number; button?: string; checkboxChecked?: boolean }
  | { filePaths: string[] }
  | { filePath: string }
  | { canceled: true };

export interface DialogRecord {
  kind: DialogKind | 'errorBox';
  options: Record<string, unknown>;
  response: unknown;
  /** False when no response was queued (that is also a violation). */
  scripted: boolean;
}

export interface SideEffect {
  kind: string;
  args: unknown[];
}

/** What a failed step reports, so it can be understood without rerunning. */
export interface FailureReport {
  message: string;
  step: string;
  query?: unknown;
  a11ySnapshot?: string;
  /** Path of a PNG taken when the step failed. */
  screenshot?: string;
  mainLog: string[];
  rendererLog: string[];
}

type NoParams = Record<string, never>;

/** Method name -> [params, result]. */
export interface DriverMethods {
  windows: [NoParams, WindowInfo[]];
  waitForWindow: [{ window?: WindowRef; timeout?: number }, WindowInfo];
  /** The accessibility tree as indented `role "name"` lines. */
  snapshot: [{ window?: WindowRef }, string];
  /** Waits for at least one match (or, with `state: 'absent'`, for none). */
  query: [Query & { state?: 'present' | 'absent' }, ElementInfo[]];
  click: [Query, ElementInfo];
  /** Types text with real key events, after clicking `query` if given. */
  type: [{ text: string; query?: Query; window?: WindowRef }, null];
  /** Presses a key combo like `Enter`, `Escape`, `CmdOrCtrl+S`, `Shift+Tab`. */
  press: [{ key: string; query?: Query; window?: WindowRef }, null];
  runCommand: [{ id: string; window?: WindowRef }, null];
  stores: [{ window?: WindowRef }, { app: unknown; window: unknown }];
  clipboard: [NoParams, string];
  /** Main's log, and the renderers' console messages. */
  logs: [{ tail?: number }, { main: string[]; renderer: string[] }];
  screenshot: [
    { window?: WindowRef; path?: string },
    { path: string; width: number; height: number },
  ];
  /** No pending IPC, network or animation frames, twice in a row. */
  waitForIdle: [{ timeout?: number; window?: WindowRef }, { waitedMs: number }];
  /** Evaluates an expression in the renderer's main world (exploration and debugging). */
  evaluate: [{ expression: string; window?: WindowRef }, unknown];
  /** A request from main, through Node's `fetch` or Electron's `net.fetch`, to check the network guard. */
  mainFetch: [
    { url: string; via: 'node' | 'net' },
    { status: number } | { error: string },
  ];
  queueDialog: [{ kind: DialogKind; response: DialogResponse }, null];
  dialogs: [NoParams, DialogRecord[]];
  sideEffects: [NoParams, SideEffect[]];
  /** Non-loopback requests, unexpected dialogs and renderer crashes. Should stay empty. */
  violations: [NoParams, string[]];
  /** What a failed step would report right now (screenshot, snapshot, log tails), titled `title`. */
  report: [{ title: string }, FailureReport];
  quit: [NoParams, null];
}

export type DriverMethod = keyof DriverMethods;

export interface DriverRequest {
  id: number;
  method: DriverMethod;
  params?: unknown;
}

export type DriverResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: FailureReport };
