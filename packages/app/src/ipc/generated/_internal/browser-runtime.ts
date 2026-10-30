/* eslint-disable */

// Runtime shared by the generated browser/<module>.ts files (emitted by
// @marshallofsound/ipc; do not edit).
//
// Each browser/<module>.ts describes its interfaces as data - one row per
// method, store and event - and calls defineInterface() below, which registers
// the ipc handlers and builds the dispatcher. Keeping the wiring here instead
// of emitting a closure per method keeps the generated output small.
//
// Contract:
// - Channels are `<modulePrefix><Interface>_$_<method>`, with
//   `_$store$_getState|getStateSync|update` appended for stores; these are the
//   same strings the matching preload/<module>.ts uses.
// - Per call: origin validator first, then each declared argument in order,
//   then the implementation (called with exactly the declared number of
//   arguments), then the result validator for non-void methods.
// - The error messages are observable behaviour (thrown to callers, returned
//   as { error } for [Sync] calls, logged) so their text is kept stable.

import type { IpcMainEvent, IpcMainInvokeEvent, WebContents, WebFrameMain } from 'electron';

export type Target = WebContents | WebFrameMain;
export type IncomingEvent = IpcMainEvent | IpcMainInvokeEvent;
export type Validator = (value: unknown) => boolean;
export type OriginValidator = (event: IncomingEvent) => boolean;

/** One [name, validator] pair per declared parameter, in declaration order. */
export type Args = [name: string, validator: Validator][];

/**
 * [method, args]                    async, returns void
 * [method, args, result]            async, result validated before it is returned
 * [method, args, result, 'sync']    [Sync] method (ipc.on + event.returnValue); result is null for void
 */
export type MethodRow<Impl> = [method: MethodName<Impl>, args: Args, result?: Validator | null, mode?: 'sync'];
/** [store, state validator] - serves getState/getStateSync from impl.getInitial<Store>State() and exposes update<Store>Store(). */
export type StoreRow<Renderer> = [store: StoreName<Renderer>, state: Validator];
/** [event, args] - becomes dispatch<Event>() on the dispatcher. */
export type EventRow<Dispatcher> = [event: EventName<Dispatcher>, args: Args];

export interface Rows<Impl, Renderer, Dispatcher> {
  methods?: MethodRow<Impl>[];
  stores?: StoreRow<Renderer>[];
  events?: EventRow<Dispatcher>[];
}

// Row names are checked against the generated I<Name>Impl / I<Name>Renderer /
// I<Name>Dispatcher types, so a row can only name a method the implementation
// has, a store the renderer exposes (exact name, as it is part of the channel)
// and an event the dispatcher declares.
type MethodName<Impl> = keyof Impl & string;
type StoreName<Renderer> = { [K in keyof Renderer & string]: K extends `${infer S}Store` ? S : never }[keyof Renderer & string];
type EventName<Dispatcher> = { [K in keyof Dispatcher & string]: K extends `dispatch${infer E}` ? E | Uncapitalize<E> : never }[keyof Dispatcher & string];

export interface Interface<Impl, Dispatcher> {
  getDispatcher(target: Target): Dispatcher | undefined;
  for(target: Target): { setImplementation: (impl: Impl) => Dispatcher };
}

export const string: Validator = (value) => typeof value === 'string';
export const number: Validator = (value) => typeof value === 'number';
export const boolean: Validator = (value) => typeof value === 'boolean';
export const unknown: Validator = () => true;
export const optional =
  (inner: Validator): Validator =>
  (value) =>
    value === undefined || inner(value);
export const nullable =
  (inner: Validator): Validator =>
  (value) =>
    value === null || inner(value);
export const arrayOf =
  (inner: Validator): Validator =>
  (value) =>
    Array.isArray(value) && value.every((item) => inner(item));

const STORE = '_$store$_';
const upFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function invalidOrigin(iface: string, event: IncomingEvent, method: string, storeOp?: 'getState' | 'getStateSync'): Error {
  const call = storeOp ? `"${method}" store ${storeOp}` : `"${method}"`;
  return new Error(`Incoming ${call} call on interface "${iface}" from '${event.senderFrame?.url}' did not pass origin validation`);
}

function invalidArgument(iface: string, kind: 'method' | 'event', method: string, arg: string, position: number): Error {
  return new Error(`Argument "${arg}" at position ${position} to ${kind} "${method}" in interface "${iface}" failed to pass validation`);
}

function invalidResult(iface: string, method: string): Error {
  return new Error(`Result from method "${method}" in interface "${iface}" failed to pass validation`);
}

function invalidInitialState(iface: string, store: string): Error {
  return new Error(`Result from store "${store}" getInitialState in interface "${iface}" failed to pass validation`);
}

function invalidStoreUpdate(iface: string, store: string): Error {
  return new Error(`State passed to update${upFirst(store)}Store in interface "${iface}" failed to pass validation`);
}

// Validates the declared arguments in order and returns exactly that many
// (extra incoming values are dropped, missing ones stay undefined), which is
// what the implementation is then called with. Plain loop: this is on the hot
// path of every call.
function checkArguments(iface: string, kind: 'method' | 'event', method: string, args: Args, incoming: readonly unknown[]): unknown[] {
  const checked = new Array<unknown>(args.length);
  for (let position = 0; position < args.length; position++) {
    const value = incoming[position];
    if (!args[position]![1](value)) throw invalidArgument(iface, kind, method, args[position]![0], position);
    checked[position] = value;
  }
  return checked;
}

type Handler = (event: IncomingEvent, ...incoming: unknown[]) => Promise<unknown>;

// [Sync] callers block on event.returnValue, so failures are reported through
// it rather than thrown (a throw would leave the renderer hanging).
const replySync =
  (handler: Handler) =>
  async (event: IpcMainEvent, ...incoming: unknown[]): Promise<void> => {
    try {
      event.returnValue = { result: await handler(event, ...incoming) };
    } catch (err) {
      event.returnValue = { error: err instanceof Error ? err.message : String(err) };
    }
  };

export function defineInterface<Impl, Renderer, Dispatcher>(
  modulePrefix: string,
  iface: string,
  validateOrigin: OriginValidator,
  rows: Rows<Impl, Renderer, Dispatcher>,
): Interface<Impl, Dispatcher> {
  const { methods = [], stores = [], events = [] } = rows;
  const prefix = modulePrefix + iface + '_$_';
  const dispatchers = new WeakMap<Target, Dispatcher>();

  return {
    getDispatcher(target) {
      return dispatchers.get(target);
    },
    for(target) {
      return {
        setImplementation: (impl) => {
          // Rows are type-checked against Impl where they are emitted; here the
          // implementation is only ever indexed with names taken from those rows.
          const implementation = impl as Record<string, ((...args: unknown[]) => unknown) | undefined>;
          const call = (name: string, args: unknown[]) => (implementation[name] as (...args: unknown[]) => unknown)(...args);

          for (const [method, args, result, mode] of methods) {
            const channel = prefix + method;
            const handler: Handler = async (event, ...incoming) => {
              if (!validateOrigin(event)) throw invalidOrigin(iface, event, method);
              const value = await call(method, checkArguments(iface, 'method', method, args, incoming));
              if (!result) return undefined;
              if (!result(value)) throw invalidResult(iface, method);
              return value;
            };
            if (mode === 'sync') {
              target.ipc.removeAllListeners(channel);
              target.ipc.on(channel, replySync(handler));
            } else {
              target.ipc.removeHandler(channel);
              target.ipc.handle(channel, handler);
            }
          }

          for (const [store, state] of stores) {
            const channel = prefix + store + STORE;
            const getInitialState = 'getInitial' + upFirst(store) + 'State';
            const handler =
              (storeOp: 'getState' | 'getStateSync'): Handler =>
              async (event) => {
                if (!validateOrigin(event)) throw invalidOrigin(iface, event, store, storeOp);
                const value = await call(getInitialState, []);
                if (!state(value)) throw invalidInitialState(iface, store);
                return value;
              };
            target.ipc.removeHandler(channel + 'getState');
            target.ipc.handle(channel + 'getState', handler('getState'));
            target.ipc.removeAllListeners(channel + 'getStateSync');
            target.ipc.on(channel + 'getStateSync', replySync(handler('getStateSync')));
          }

          const dispatcher: Record<string, (...args: unknown[]) => void> = {};
          for (const [name, args] of events) {
            const channel = prefix + name;
            dispatcher['dispatch' + upFirst(name)] = (...outgoing) => {
              target.send(channel, ...checkArguments(iface, 'event', name, args, outgoing));
            };
          }
          for (const [store, state] of stores) {
            const channel = prefix + store + STORE + 'update';
            dispatcher['update' + upFirst(store) + 'Store'] = (value) => {
              if (!state(value)) throw invalidStoreUpdate(iface, store);
              target.send(channel, value);
            };
          }

          dispatchers.set(target, dispatcher as Dispatcher);
          return dispatcher as Dispatcher;
        },
      };
    },
  };
}
