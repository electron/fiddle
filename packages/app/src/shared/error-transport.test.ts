import { describe, expect, it, vi } from 'vitest';

import {
  decodeError,
  type ErrorTransform,
  wrapImplementation,
  wrapRendererApi,
} from './error-transport';
import { ErrorCode, FiddleError } from './errors';

/**
 * Stands in for EIPC + Electron: the main-side implementation is wrapped, and
 * a rejected call reaches the renderer only as an Error carrying the message,
 * prefixed the way `ipcRenderer.invoke` prefixes it.
 */
function overIpc<T extends object>(impl: T, log = vi.fn(), transform?: ErrorTransform) {
  const main = wrapImplementation(impl, log, transform) as Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  >;
  const bridged: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(main)) {
    bridged[name] = (...args: unknown[]) =>
      fn(...args).catch((error: Error) => {
        throw new Error(
          `Error invoking remote method 'fiddle_${name}': Error: ${error.message}`,
        );
      });
  }
  return { api: wrapRendererApi(bridged as T), log };
}

describe('FiddleError transport', () => {
  it('re-throws a FiddleError with its code, message and details', async () => {
    const { api, log } = overIpc({
      async Load(): Promise<string> {
        throw new FiddleError(ErrorCode.notFound, 'No such fiddle', { id: 'abc' });
      },
    });

    const error = await api.Load().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FiddleError);
    expect(error).toMatchObject({
      code: 'not-found',
      message: 'No such fiddle',
      details: { id: 'abc' },
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('sends a FiddleError as the transform rewrites it', async () => {
    const { api, log } = overIpc(
      {
        async Load(): Promise<string> {
          throw new FiddleError(ErrorCode.notFound, 'No such fiddle', { id: 'abc' });
        },
      },
      undefined,
      (e) => new FiddleError(e.code, 'Kein solches Fiddle', e.details),
    );

    await expect(api.Load()).rejects.toMatchObject({
      code: 'not-found',
      message: 'Kein solches Fiddle',
      details: { id: 'abc' },
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('turns unexpected errors into internal errors and logs them in main', async () => {
    const boom = new TypeError('cannot read x of undefined');
    const { api, log } = overIpc({
      // Throws synchronously; the wrapper still reports it as a rejection.
      Explode: (): Promise<string> => {
        throw boom;
      },
    });

    const error = await api.Explode().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FiddleError);
    expect(error).toMatchObject({
      code: ErrorCode.internal,
      message: 'cannot read x of undefined',
    });
    expect(log).toHaveBeenCalledWith(boom);
  });

  it('passes results through untouched', async () => {
    const { api } = overIpc({ Add: async (a: number, b: number) => a + b });
    await expect(api.Add(2, 3)).resolves.toBe(5);
  });

  it('keeps code and message when details cannot be serialized', async () => {
    const { api } = overIpc({
      Fail: (): Promise<void> => {
        throw new FiddleError(ErrorCode.conflict, 'Busy', { big: 1n });
      },
    });

    const error = await api.Fail().catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: ErrorCode.conflict,
      message: 'Busy',
      details: undefined,
    });
  });

  it('passes plain values and synchronous results through on both sides', () => {
    const main = wrapImplementation({ version: 3, Ping: () => 'pong' }, vi.fn());
    expect(main.version).toBe(3);
    const api = wrapRendererApi({
      version: 3,
      AppStore: { getStateSync: () => ({ locale: 'en' }) },
    });
    expect(api.version).toBe(3);
    expect(api.AppStore.getStateSync()).toEqual({ locale: 'en' });
  });

  it('wraps nested objects and synchronous throws on the renderer side', () => {
    const api = wrapRendererApi({
      AppStore: {
        getStateSync(): never {
          throw new Error('@@FiddleError@@{"code":"unavailable","message":"Not ready"}');
        },
      },
    });

    expect(() => api.AppStore.getStateSync()).toThrow(FiddleError);
    expect(() => api.AppStore.getStateSync()).toThrow('Not ready');
  });

  it('treats errors without a payload as internal', () => {
    const error = decodeError(
      new Error('Incoming "RunCommand" call did not pass origin validation'),
    );
    expect(error).toBeInstanceOf(FiddleError);
    expect(error.code).toBe(ErrorCode.internal);
  });
});
