import { describe, expect, it } from 'vitest';

import { isExpandable, previewText } from './console-preview';
import type { ConsoleValue } from './stores';

const num = (n: number): ConsoleValue => ({ type: 'number', description: String(n) });
const str = (text: string): ConsoleValue => ({ type: 'string', description: text });
const fn: ConsoleValue = { type: 'function', description: 'ƒ f()' };

describe('previewText', () => {
  it('previews objects as DevTools does', () => {
    const listeners: ConsoleValue = {
      type: 'object',
      description: 'Object',
      props: [
        'listener1',
        'listener2',
        'listener3',
        'listener4',
        'listener5',
        'listener6',
      ].map((key) => [key, fn]),
    };
    expect(previewText([listeners])).toBe(
      '{listener1: ƒ, listener2: ƒ, listener3: ƒ, listener4: ƒ, listener5: ƒ, …}',
    );
    expect(
      previewText([
        {
          type: 'object',
          description: 'Point',
          props: [
            ['x', num(1)],
            ['nested', { type: 'object', description: 'Object' }],
            ['list', { type: 'array', description: 'Array(2)' }],
          ],
        },
      ]),
    ).toBe('Point {x: 1, nested: {…}, list: Array(2)}');
  });

  it('previews arrays, maps and sets, and prints top-level strings as is', () => {
    expect(
      previewText([
        str('label'),
        {
          type: 'array',
          description: 'Array(2)',
          props: [
            ['0', str('a')],
            ['1', num(2)],
          ],
          more: 3,
        },
        { type: 'map', description: 'Map(1)', props: [["'k'", str('v')]] },
        { type: 'set', description: 'Set(1)', props: [['0', num(1)]] },
        { type: 'array', description: 'Uint8Array(1)', props: [['0', num(0)]] },
      ]),
    ).toBe("label (2) ['a', 2, …] Map(1) {'k' => 'v'} Set(1) {1} Uint8Array(1) [0]");
  });

  it('shows objects that were too deep to serialize collapsed', () => {
    const deep: ConsoleValue = { type: 'object', description: 'Object' };
    expect(previewText([deep])).toBe('{…}');
    expect(isExpandable(deep)).toBe(false);
    expect(isExpandable({ ...deep, props: [] })).toBe(false);
    expect(isExpandable({ ...deep, props: [['a', num(1)]] })).toBe(true);
  });
});
