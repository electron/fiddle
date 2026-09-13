/** What the test harness records while the app runs. No Electron imports. */
import type {
  ConsoleLine,
  DialogKind,
  DialogRecord,
  DialogResponse,
  SideEffect,
} from './protocol';

export class Ring {
  readonly #lines: string[] = [];
  readonly #max: number;

  constructor(max: number) {
    this.#max = max;
  }

  push(line: string): void {
    this.#lines.push(line);
    if (this.#lines.length > this.#max) this.#lines.shift();
  }

  tail(count = this.#max): string[] {
    return this.#lines.slice(-count);
  }
}

export interface TestState {
  testDir: string;
  mainLog: Ring;
  rendererLog: Ring;
  /** DevTools console messages per webContents ID. */
  consoles: Map<number, ConsoleLine[]>;
  sideEffects: SideEffect[];
  dialogs: DialogRecord[];
  dialogQueue: Record<DialogKind, DialogResponse[]>;
  violations: string[];
  /** In-flight network requests (Chromium and Node). */
  inflight: Set<string>;
  /** IPC invocations whose handler hasn't returned. */
  pendingIpc: number;
  violation(message: string): void;
}

export function createTestState(testDir: string): TestState {
  const state: TestState = {
    testDir,
    mainLog: new Ring(2000),
    rendererLog: new Ring(2000),
    consoles: new Map(),
    sideEffects: [],
    dialogs: [],
    dialogQueue: { messageBox: [], open: [], save: [] },
    violations: [],
    inflight: new Set(),
    pendingIpc: 0,
    violation(message) {
      if (!state.violations.includes(message)) state.violations.push(message);
      state.mainLog.push(`[test] VIOLATION ${message}`);
    },
  };
  return state;
}
