import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutputLine } from '../../shared/stores';
import { OUTPUT_BATCH_MS, OUTPUT_LIMIT, OutputBuffer } from './output-buffer';

const line = (text: string) => ({ process: 'main' as const, kind: 'log' as const, text });

describe('OutputBuffer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('batches lines every 16 ms with increasing sequence numbers', () => {
    const batches: OutputLine[][] = [];
    const buffer = new OutputBuffer(
      (lines) => batches.push(lines),
      () => 42,
    );
    buffer.push(line('a'));
    buffer.push(line('b'));
    expect(batches).toEqual([]);
    vi.advanceTimersByTime(OUTPUT_BATCH_MS);
    expect(batches).toEqual([
      [
        { ...line('a'), seq: 1, time: 42 },
        { ...line('b'), seq: 2, time: 42 },
      ],
    ]);
    buffer.push(line('c'));
    vi.advanceTimersByTime(OUTPUT_BATCH_MS);
    expect(batches[1]?.map((l) => l.seq)).toEqual([3]);
  });

  it('keeps the last 1000 lines and caps a batch at the same size', () => {
    const batches: OutputLine[][] = [];
    const buffer = new OutputBuffer((lines) => batches.push(lines));
    for (let i = 0; i < OUTPUT_LIMIT + 5; i++) buffer.push(line(String(i)));
    expect(buffer.lines).toHaveLength(OUTPUT_LIMIT);
    expect(buffer.lines[0]?.seq).toBe(6);
    vi.advanceTimersByTime(OUTPUT_BATCH_MS);
    expect(batches[0]).toHaveLength(OUTPUT_LIMIT);
  });

  it('clears the backlog but never reuses sequence numbers', () => {
    const buffer = new OutputBuffer(() => {});
    buffer.push(line('a'));
    expect(buffer.clear()).toBe(1);
    expect(buffer.lines).toEqual([]);
    expect(buffer.push(line('b')).seq).toBe(2);
    buffer.dispose();
  });
});
