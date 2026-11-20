'use strict';
/* global Node, module, require, setImmediate */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Loaded into a fiddle's main process with `NODE_OPTIONS=--require`, so the
 * console can show a renderer's objects as DevTools does. Chromium's own log
 * line for `console.log({ a: 1 })` reads `[object Object]`; this hook watches
 * each page through `webContents.debugger`, serializes the arguments of every
 * console call that has an object, and writes them to stderr as a record. The
 * app's output parser attaches the record to Chromium's line for the call.
 *
 * Plain JavaScript, written into the run directory as is: it runs in whatever
 * Electron the fiddle uses, and `serializeArgs` runs in the page.
 */

const RECORD_PREFIX = '\u001efiddle-console ';

/**
 * Runs in the page, through `Runtime.callFunctionOn`, so it must be
 * self-contained. Returns Chromium's text for the call, to match the record to
 * its log line, and a bounded tree of each argument. Accessors aren't called,
 * and anything that throws becomes an `[Exception: …]` value.
 *
 * @param {number[]} proxies The indexes of arguments that are proxies, which are passed as `null`.
 * @param {...unknown} args
 */
function serializeArgs(proxies, ...args) {
  const MAX_DEPTH = 4;
  const MAX_PROPS = 100;
  const MAX_STRING = 500;
  const MAX_TOP_STRING = 10000;
  // About the size of the record in characters. Past it, objects stay collapsed.
  let budget = 50000;
  const toTag = Object.prototype.toString;
  const fnSource = Function.prototype.toString;

  const clip = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text);
  const describeError = (error) => {
    try {
      return { type: 'error', description: `[Exception: ${String(error)}]` };
    } catch {
      return { type: 'error', description: '[Exception]' };
    }
  };
  const isNode = (value) => typeof Node === 'function' && value instanceof Node;

  // Chromium's text for one argument (V8's V8ValueStringBuilder): arrays are
  // joined with commas and skip null, undefined and cycles; other objects,
  // except dates, functions, errors and regexps, are `[object Tag]`.
  let arrayItems = 10000;
  const flat = (value, arrays) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    const type = typeof value;
    if (type === 'string') return value;
    if (type === 'bigint') return `${value}n`;
    if (type === 'symbol') return value.toString();
    if (type !== 'object' && type !== 'function') return String(value);
    if (Array.isArray(value)) {
      if (arrays.includes(value)) return '';
      arrayItems -= value.length;
      if (arrayItems < 0 || arrays.length > 32) throw new RangeError('too long');
      arrays.push(value);
      const parts = [];
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        parts.push(item === null || item === undefined ? '' : flat(item, arrays));
      }
      arrays.pop();
      return parts.join(',');
    }
    if (value instanceof String) return value.valueOf();
    if (
      type === 'function' ||
      value instanceof Date ||
      value instanceof Error ||
      value instanceof RegExp
    )
      return String(value);
    return toTag.call(value);
  };

  const className = (value) => {
    const proto = Object.getPrototypeOf(value);
    if (proto === null) return 'Object';
    const ctor = Object.getOwnPropertyDescriptor(proto, 'constructor');
    const name = ctor && typeof ctor.value === 'function' ? ctor.value.name : '';
    return typeof name === 'string' && name ? name : 'Object';
  };

  const functionLabel = (fn) => {
    let source = '';
    try {
      source = fnSource.call(fn);
    } catch {
      // A revoked proxy, for example.
    }
    const nameProp = Object.getOwnPropertyDescriptor(fn, 'name');
    const name = nameProp && typeof nameProp.value === 'string' ? nameProp.value : '';
    if (/^class\b/.test(source)) return `class ${name}`;
    const async = toTag.call(fn) === '[object AsyncFunction]' ? 'async ' : '';
    return `${async}ƒ ${name}()`;
  };

  const leaf = (type, description) => {
    budget -= description.length + 20;
    return { type, description };
  };

  // Stands in for a getter or setter, which isn't called.
  const ACCESSOR = {};

  const node = (value, depth, ancestors, maxString = MAX_STRING) => {
    try {
      if (value === ACCESSOR) return leaf('accessor', '(...)');
      if (value === null) return leaf('null', 'null');
      const type = typeof value;
      if (type === 'undefined') return leaf('undefined', 'undefined');
      if (type === 'string') return leaf('string', clip(value, maxString));
      if (type === 'number')
        return leaf('number', Object.is(value, -0) ? '-0' : String(value));
      if (type === 'bigint') return leaf('bigint', `${value}n`);
      if (type === 'boolean') return leaf('boolean', String(value));
      if (type === 'symbol') return leaf('symbol', value.toString());
      if (type === 'function') return leaf('function', functionLabel(value));
      if (ancestors.includes(value)) return leaf('circular', '[Circular]');
      if (value instanceof Error)
        return leaf('error', clip(String(value.stack || value), maxString * 4));
      if (value instanceof Date)
        return leaf(
          'date',
          Number.isNaN(value.getTime()) ? 'Invalid Date' : String(value),
        );
      if (value instanceof RegExp) return leaf('regexp', String(value));
      if (isNode(value)) {
        const name = String(value.nodeName).toLowerCase();
        return leaf('node', name.startsWith('#') ? name : `<${name}>`);
      }
      if (value instanceof Promise) return leaf('object', 'Promise');

      const name = className(value);
      let result;
      let entries;
      if (Array.isArray(value)) {
        result = { type: 'array', description: `Array(${value.length})` };
        entries = (add) => {
          for (let i = 0; i < value.length; i++) if (!add(String(i), value[i])) return;
          ownProps(value, add, true);
        };
      } else if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
        result = { type: 'array', description: `${name}(${value.length})` };
        entries = (add) => {
          for (let i = 0; i < value.length; i++) if (!add(String(i), value[i])) return;
        };
      } else if (value instanceof Map) {
        result = { type: 'map', description: `${name}(${value.size})` };
        entries = (add) => {
          for (const [key, item] of value) if (!add(keyLabel(key), item)) return;
        };
      } else if (value instanceof Set) {
        result = { type: 'set', description: `${name}(${value.size})` };
        entries = (add) => {
          let i = 0;
          for (const item of value) if (!add(String(i++), item)) return;
        };
      } else {
        result = { type: 'object', description: name };
        entries = (add) => ownProps(value, add, false);
      }
      budget -= result.description.length + 20;
      if (depth >= MAX_DEPTH || budget <= 0) return result;

      const props = [];
      let more = 0;
      const inner = ancestors.concat([value]);
      entries((key, item) => {
        if (props.length >= MAX_PROPS || budget <= 0) {
          more++;
          return true;
        }
        budget -= key.length;
        props.push([clip(key, MAX_STRING), node(item, depth + 1, inner)]);
        return true;
      });
      result.props = props;
      if (more > 0) result.more = more;
      return result;
    } catch (error) {
      return describeError(error);
    }
  };

  // Own enumerable properties; with `skipIndexes`, the non-index ones of an array.
  const ownProps = (value, add, skipIndexes) => {
    for (const key of Reflect.ownKeys(value)) {
      if (skipIndexes && typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) continue;
      if (skipIndexes && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable) continue;
      const label = typeof key === 'symbol' ? key.toString() : key;
      if (!add(label, 'value' in descriptor ? descriptor.value : ACCESSOR)) return;
    }
  };

  // Map keys are shown inline, as `key => value`.
  const keyLabel = (key) => {
    if (typeof key === 'string') return `'${key}'`;
    if (typeof key === 'object' && key !== null) {
      try {
        return Array.isArray(key) ? `Array(${key.length})` : className(key);
      } catch {
        return 'Object';
      }
    }
    if (typeof key === 'function') return 'ƒ';
    return typeof key === 'bigint' ? `${key}n` : String(key);
  };

  let text;
  try {
    text = args
      .map((arg, i) => (proxies.includes(i) ? '[object Proxy]' : flat(arg, [])))
      .join(' ');
  } catch {
    text = null;
  }
  const values = args.map((arg, i) =>
    proxies.includes(i) ? leaf('object', 'Proxy') : node(arg, 0, [], MAX_TOP_STRING),
  );
  return { text, values };
}

const SERIALIZE_ARGS = serializeArgs.toString();

/** A `Runtime.RemoteObject` as a `Runtime.CallArgument`. */
function callArgument(arg) {
  if (arg.objectId) return { objectId: arg.objectId };
  if (arg.unserializableValue) return { unserializableValue: arg.unserializableValue };
  return { value: arg.value };
}

/**
 * Serializes the arguments of a `Runtime.consoleAPICalled` event in the page.
 * Resolves with the record for it, or `undefined` when it has no object
 * argument or can't be serialized.
 */
async function describeCall(send, params) {
  const args = params.args || [];
  if (!args.some((arg) => arg.type === 'object' || arg.type === 'function')) return;
  const frame = params.stackTrace && params.stackTrace.callFrames[0];
  // Proxies are left out, so serializing doesn't run their traps.
  const proxies = [];
  const callArgs = args.map((arg, i) => {
    if (arg.subtype !== 'proxy') return callArgument(arg);
    proxies.push(i);
    return { value: null };
  });
  try {
    const { result } = await send('Runtime.callFunctionOn', {
      functionDeclaration: SERIALIZE_ARGS,
      executionContextId: params.executionContextId,
      arguments: [{ value: proxies }, ...callArgs],
      returnByValue: true,
      silent: true,
    });
    const value = result && result.value;
    if (!value || typeof value.text !== 'string') return;
    return {
      source: frame ? frame.url : '',
      line: frame ? frame.lineNumber + 1 : 0,
      text: value.text,
      values: value.values,
    };
  } finally {
    for (const arg of args) {
      if (arg.objectId)
        send('Runtime.releaseObject', { objectId: arg.objectId }).catch(() => {});
    }
  }
}

/**
 * Watches a page's console through its debugger and passes a record for each
 * call with an object argument to `write`, in order. Steps aside when the
 * fiddle attaches the debugger itself.
 */
function watch(contents, write) {
  if (contents.getType() === 'remote') return; // DevTools
  const dbg = contents.debugger;
  if (dbg.isAttached()) return;
  try {
    dbg.attach('1.3');
  } catch {
    return;
  }
  const send = (method, params) => dbg.sendCommand(method, params);
  let queue = Promise.resolve();
  const onMessage = (_event, method, params) => {
    if (method !== 'Runtime.consoleAPICalled') return;
    const record = describeCall(send, params).catch(() => undefined);
    queue = queue.then(() => record).then((value) => value && write(value));
  };
  const release = () => {
    dbg.removeListener('message', onMessage);
    dbg.removeListener('detach', release);
    delete dbg.attach;
    delete dbg.isAttached;
  };
  // The fiddle sees the debugger as free, and attaching it replaces this session.
  dbg.isAttached = () => false;
  dbg.attach = (...args) => {
    release();
    try {
      dbg.detach();
    } catch {
      // Already detached.
    }
    return dbg.attach(...args);
  };
  dbg.on('message', onMessage);
  dbg.on('detach', release);
  send('Runtime.enable').catch(() => {});
}

function install() {
  // Electron is loaded on a later tick: a `--require` module runs before it's set up.
  setImmediate(() => {
    if (process.type !== 'browser') return;
    const { app, webContents } = require('electron');
    const write = (record) => {
      process.stderr.write(`${RECORD_PREFIX}${JSON.stringify(record)}\n`);
    };
    const start = (contents) => {
      try {
        watch(contents, write);
      } catch {
        // The console falls back to Chromium's text.
      }
    };
    webContents.getAllWebContents().forEach(start);
    app.on('web-contents-created', (_event, contents) => start(contents));
  });
}

if (process.versions.electron) {
  // Processes the fiddle starts don't load the hook.
  delete process.env.NODE_OPTIONS;
  install();
}

module.exports = { RECORD_PREFIX, describeCall, serializeArgs, watch };
