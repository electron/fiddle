import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

import { describe, expect, it, vi } from 'vitest';

import type { ConsoleValue } from '../../shared/stores';
import { RECORD_PREFIX } from './output-parser';

interface HookRecord {
  source: string;
  line: number;
  text: string;
  values: ConsoleValue[];
}
type Send = (method: string, params?: object) => Promise<{ result?: { value: unknown } }>;

const hook = createRequire(import.meta.url)('./console-hook.cjs') as {
  RECORD_PREFIX: string;
  serializeArgs: (
    proxies: number[],
    ...args: unknown[]
  ) => { text: string | null; values: ConsoleValue[] };
  describeCall: (send: Send, params: object) => Promise<HookRecord | undefined>;
  watch: (contents: object, write: (record: HookRecord) => void) => void;
};

const serialize = (...args: unknown[]) => hook.serializeArgs([], ...args);

/** Erick's case: an emitter's `_events`, a null-prototype object of listeners. */
const events = () =>
  Object.assign(Object.create(null) as object, {
    listener1() {},
    listener2: () => {},
    async listener3() {},
    listener4: class Listener4 {},
  });

it('writes records with the prefix the output parser reads', () => {
  expect(hook.RECORD_PREFIX).toBe(RECORD_PREFIX);
});

describe('serializeArgs', () => {
  it("gives Chromium's text for the call, to match its log line", () => {
    const fn = function named() {};
    expect(
      serialize(
        'a',
        events(),
        1,
        null,
        undefined,
        [1, null, [2, { x: 1 }]],
        new Map(),
        fn,
      ).text,
    ).toBe(
      `a [object Object] 1 null undefined 1,,2,[object Object] [object Map] ${String(fn)}`,
    );
    expect(serialize(new Error('boom'), /re/g, Symbol('s'), 10n, -0).text).toBe(
      'Error: boom /re/g Symbol(s) 10n 0',
    );
    const cycle: unknown[] = [1];
    cycle.push(cycle);
    expect(serialize(cycle).text).toBe('1,');
    expect(hook.serializeArgs([0], null, {}).text).toBe('[object Proxy] [object Object]');
  });

  it('describes functions, nested objects and class instances', () => {
    class Point {
      x = 1;
      y = { z: [1, 'two'] };
    }
    const [listeners, point] = serialize(events(), new Point()).values;
    expect(listeners).toEqual({
      type: 'object',
      description: 'Object',
      props: [
        ['listener1', { type: 'function', description: 'ƒ listener1()' }],
        ['listener2', { type: 'function', description: 'ƒ listener2()' }],
        ['listener3', { type: 'function', description: 'async ƒ listener3()' }],
        ['listener4', { type: 'function', description: 'class Listener4' }],
      ],
    });
    expect(point).toEqual({
      type: 'object',
      description: 'Point',
      props: [
        ['x', { type: 'number', description: '1' }],
        [
          'y',
          {
            type: 'object',
            description: 'Object',
            props: [
              [
                'z',
                {
                  type: 'array',
                  description: 'Array(2)',
                  props: [
                    ['0', { type: 'number', description: '1' }],
                    ['1', { type: 'string', description: 'two' }],
                  ],
                },
              ],
            ],
          },
        ],
      ],
    });
  });

  it('describes maps, sets, errors, dates and cycles', () => {
    const self: { [key: string]: unknown } = {};
    self.self = self;
    const [map, set, error, date, cycle] = serialize(
      new Map<unknown, unknown>([
        ['k', 1],
        [{}, 2],
      ]),
      new Set([true]),
      new Error('boom'),
      new Date(Number.NaN),
      self,
    ).values;
    expect(map).toMatchObject({
      type: 'map',
      description: 'Map(2)',
      props: [
        ["'k'", { type: 'number', description: '1' }],
        ['Object', { type: 'number', description: '2' }],
      ],
    });
    expect(set).toMatchObject({
      type: 'set',
      description: 'Set(1)',
      props: [['0', { type: 'boolean', description: 'true' }]],
    });
    expect(error?.type).toBe('error');
    expect(error?.description).toMatch(/^Error: boom\n\s+at /);
    expect(date).toEqual({ type: 'date', description: 'Invalid Date' });
    expect(cycle?.props).toEqual([
      ['self', { type: 'circular', description: '[Circular]' }],
    ]);
  });

  it("doesn't call getters, and survives traps that throw", () => {
    const getter = vi.fn(() => 1);
    const trap = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('trapped');
        },
      },
    );
    const [value] = serialize({
      get g() {
        return getter();
      },
      trap,
    }).values;
    expect(getter).not.toHaveBeenCalled();
    expect(value?.props).toEqual([
      ['g', { type: 'accessor', description: '(...)' }],
      ['trap', { type: 'error', description: '[Exception: Error: trapped]' }],
    ]);
  });

  it('stops at a depth, a property count and a size', () => {
    const [deep, wide, huge] = serialize(
      { a: { b: { c: { d: { e: {} } } } } },
      Array.from({ length: 250 }, (_, i) => i),
      Array.from({ length: 2000 }, () => ({ text: 'x'.repeat(400) })),
    ).values;
    let node = deep;
    for (let depth = 0; depth < 4; depth++) node = node?.props?.[0]?.[1];
    expect(node).toEqual({ type: 'object', description: 'Object' });
    expect(wide?.props).toHaveLength(100);
    expect(wide?.more).toBe(150);
    expect(JSON.stringify(huge).length).toBeLessThan(80_000);
  });
});

/** A page: `Runtime.callFunctionOn` runs the function here, on objects by id. */
function fakePage() {
  const objects = new Map<string, unknown>();
  const send = vi.fn<Send>(async (method, params) => {
    if (method !== 'Runtime.callFunctionOn') return {};
    const { functionDeclaration, arguments: args } = params as {
      functionDeclaration: string;
      arguments: { objectId?: string; value?: unknown }[];
    };
    const fn = new Function(`return (${functionDeclaration})`)() as (
      ...args: unknown[]
    ) => unknown;
    const value = fn(
      ...args.map((arg) => (arg.objectId ? objects.get(arg.objectId) : arg.value)),
    );
    return { result: { value: JSON.parse(JSON.stringify(value)) as unknown } };
  });
  /** A `Runtime.consoleAPICalled` event for `args`, logged from renderer.js:3. */
  const event = (...args: unknown[]) => ({
    executionContextId: 1,
    args: args.map((arg) => {
      if (typeof arg !== 'object' && typeof arg !== 'function')
        return { type: typeof arg, value: arg };
      const objectId = String(objects.size + 1);
      objects.set(objectId, arg);
      return { type: typeof arg, objectId };
    }),
    stackTrace: { callFrames: [{ url: 'file:///app/renderer.js', lineNumber: 2 }] },
  });
  return { send, event };
}

describe('describeCall', () => {
  it('serializes the arguments in the page, and releases them', async () => {
    const { send, event } = fakePage();
    const record = await hook.describeCall(send, event('x', { a: 1 }));
    expect(record).toEqual({
      source: 'file:///app/renderer.js',
      line: 3,
      text: 'x [object Object]',
      values: [
        { type: 'string', description: 'x' },
        {
          type: 'object',
          description: 'Object',
          props: [['a', { type: 'number', description: '1' }]],
        },
      ],
    });
    expect(send).toHaveBeenCalledWith('Runtime.releaseObject', { objectId: '1' });
  });

  it('skips calls without an object', async () => {
    const { send, event } = fakePage();
    expect(await hook.describeCall(send, event('x', 1))).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('watch', () => {
  function fakeContents() {
    const page = fakePage();
    const attach = vi.fn();
    const detach = vi.fn();
    class FakeDebugger extends EventEmitter {
      attach(...args: unknown[]) {
        attach(...args);
      }
      detach() {
        detach();
      }
      isAttached() {
        return false;
      }
      sendCommand = page.send;
    }
    const dbg = new FakeDebugger();
    return {
      page,
      dbg,
      attach,
      detach,
      contents: { getType: () => 'window', debugger: dbg },
    };
  }

  it('writes a record per console call with an object, in order', async () => {
    const { page, dbg, attach, contents } = fakeContents();
    const write = vi.fn();
    hook.watch(contents, write);
    expect(attach).toHaveBeenCalledWith('1.3');
    expect(page.send).toHaveBeenCalledWith('Runtime.enable', undefined);
    dbg.emit('message', {}, 'Runtime.consoleAPICalled', page.event({ n: 1 }));
    dbg.emit('message', {}, 'Runtime.consoleAPICalled', page.event('plain'));
    dbg.emit('message', {}, 'Runtime.consoleAPICalled', page.event([2]));
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(write.mock.calls.map(([record]) => (record as HookRecord).text)).toEqual([
      '[object Object]',
      '2',
    ]);
  });

  it('gives the debugger up when the fiddle attaches it', () => {
    const { dbg, attach, detach, contents } = fakeContents();
    hook.watch(contents, vi.fn());
    expect(dbg.isAttached()).toBe(false);
    expect(dbg.listenerCount('message')).toBe(1);
    dbg.attach('1.1');
    expect(detach).toHaveBeenCalled();
    expect(attach).toHaveBeenLastCalledWith('1.1');
    expect(Object.hasOwn(dbg, 'attach')).toBe(false);
    expect(dbg.listenerCount('message')).toBe(0);
  });

  it("leaves DevTools' own pages alone", () => {
    const { attach, contents } = fakeContents();
    hook.watch({ ...contents, getType: () => 'remote' }, vi.fn());
    expect(attach).not.toHaveBeenCalled();
  });
});
