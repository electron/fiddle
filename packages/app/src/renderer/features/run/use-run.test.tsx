import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutputLine, RunState } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({
  clearedSeq: 0,
  push: undefined as ((batch: OutputLine[]) => void) | undefined,
  backlog: undefined as ((lines: OutputLine[]) => void) | undefined,
  runApi: {
    onOutput: vi.fn((handler: (batch: OutputLine[]) => void) => {
      mocks.push = handler;
      return () => undefined;
    }),
    GetOutput: vi.fn(
      () => new Promise<OutputLine[]>((resolve) => (mocks.backlog = resolve)),
    ),
  },
}));

vi.mock('../../../ipc/renderer', () => ({ runApi: mocks.runApi, versionsApi: {} }));
vi.mock('../../state', () => ({
  useAppState: () => undefined,
  useWindowState: () => ({ run: { clearedSeq: mocks.clearedSeq } as RunState }),
}));

import { useConsoleLines } from './use-run';

const line = (seq: number, text = `line ${seq}`): OutputLine => ({
  seq,
  time: 0,
  process: 'fiddle',
  kind: 'log',
  text,
});

const seen: OutputLine[][] = [];
function Probe() {
  seen.push(useConsoleLines());
  return null;
}
const texts = () => (seen.at(-1) ?? []).map((l) => l.text);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clearedSeq = 0;
});
afterEach(() => {
  seen.length = 0;
});

describe('useConsoleLines', () => {
  it('holds batches that arrive before the backlog and drops lines it already has', async () => {
    render(<Probe />);
    act(() => mocks.push?.([line(3), line(4)]));
    expect(texts()).toEqual([]);
    await act(async () => mocks.backlog?.([line(1), line(2), line(3)]));
    expect(texts()).toEqual(['line 1', 'line 2', 'line 3', 'line 4']);
    act(() => mocks.push?.([line(4), line(5)]));
    expect(texts()).toEqual(['line 1', 'line 2', 'line 3', 'line 4', 'line 5']);
  });

  it('leaves out lines the run has cleared', async () => {
    const view = render(<Probe />);
    await act(async () => mocks.backlog?.([line(1), line(2), line(3)]));
    mocks.clearedSeq = 2;
    view.rerender(<Probe />);
    expect(texts()).toEqual(['line 3']);
  });

  it('shows a fiddle that writes colours as plain text', async () => {
    render(<Probe />);
    await act(async () =>
      mocks.backlog?.([
        line(1, '\u001b[31mred\u001b[0m and \u001b[1;4mbold\u001b[0m'),
        line(2, 'progress\u001b[2K\r'),
      ]),
    );
    expect(texts()).toEqual(['red and bold', 'progress\r']);
  });
});
