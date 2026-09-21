import { describe, expect, it, vi } from 'vitest';

import type { FiddleState } from '../../shared/stores';
import type { ChangeListener } from '../state-hub';
import { ModulesService, type ModulesHub } from './service';

function fakeHub(modules: Record<string, string>) {
  let fiddle = { modules } as FiddleState;
  let rev = 0;
  const writes: boolean[] = [];
  const listeners = new Set<ChangeListener>();
  const hub: ModulesHub = {
    getWindow: (id) => (id === 'w' ? { fiddle } : undefined),
    setModules: (_id, next, normalized) => {
      fiddle = { ...fiddle, modules: next };
      writes.push(normalized);
      rev += 1;
      queueMicrotask(() =>
        listeners.forEach((l) => l({ store: 'window', windowId: 'w' })),
      );
      return rev;
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { hub, modules: () => fiddle.modules, writes };
}

const npm = {
  latestVersion: vi.fn(async (name: string) => (name === 'lodash' ? '4.17.21' : '1.2.3')),
};
vi.mock('../log', () => ({ log: { warn: vi.fn() } }));

describe('ModulesService', () => {
  it('adds a module at its latest version', async () => {
    const { hub, modules } = fakeHub({});
    const service = new ModulesService(hub, npm);
    expect(await service.add('w', 'lodash')).toBe(1);
    expect(modules()).toEqual({ lodash: '4.17.21' });
  });

  it('keeps a chosen version, range or tag and resolves only a floating one', async () => {
    npm.latestVersion.mockClear();
    const { hub, modules } = fakeHub({ a: '1.0.0' });
    const service = new ModulesService(hub, npm);
    await service.add('w', 'b', '2.0.0');
    await service.add('w', 'c', '^4.18.2');
    await service.add('w', 'd', 'next');
    expect(modules()).toEqual({ a: '1.0.0', b: '2.0.0', c: '^4.18.2', d: 'next' });
    await service.setVersion('w', 'a', '*');
    expect(modules().a).toBe('1.2.3');
    expect(npm.latestVersion).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid names, specs and unknown modules', async () => {
    const service = new ModulesService(fakeHub({}).hub, npm);
    await expect(service.add('w', '../x')).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(service.add('w', 'x', 'git+https://evil')).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(service.setVersion('w', 'missing', '1.0.0')).rejects.toMatchObject({
      code: 'not-found',
    });
    await expect(service.add('nope', 'x', '1.0.0')).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('removes a module', () => {
    const { hub, modules } = fakeHub({ a: '1.0.0', b: '2.0.0' });
    new ModulesService(hub, npm).remove('w', 'a');
    expect(modules()).toEqual({ b: '2.0.0' });
  });

  it('pins loaded floating versions and keeps the specs a fiddle declares', async () => {
    const { hub, modules } = fakeHub({
      lodash: '*',
      tagged: 'latest',
      exact: '1.0.0',
      range: '^1.0.0',
      tag: 'next',
    });
    await new ModulesService(hub, npm).normalize('w');
    expect(modules()).toEqual({
      lodash: '4.17.21',
      tagged: '1.2.3',
      exact: '1.0.0',
      range: '^1.0.0',
      tag: 'next',
    });
  });

  it('writes user changes as edits and normalization as not', async () => {
    const { hub, writes } = fakeHub({ a: '*' });
    const service = new ModulesService(hub, npm);
    await service.add('w', 'b', '2.0.0');
    await service.normalize('w');
    service.remove('w', 'b');
    expect(writes).toEqual([false, true, false]);
  });

  it("doesn't overwrite a version that changed while fetching, or retry failures", async () => {
    const { hub, modules } = fakeHub({ a: '*' });
    let release = () => {};
    const slow = {
      latestVersion: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            release = () => resolve('9.9.9');
          }),
      ),
    };
    const service = new ModulesService(hub, slow);
    const pending = service.normalize('w');
    hub.setModules('w', { a: '1.0.0' }, false);
    release();
    await pending;
    expect(modules()).toEqual({ a: '1.0.0' });

    const failing = {
      latestVersion: vi.fn(async () => Promise.reject(new Error('offline'))),
    };
    const other = fakeHub({ b: 'latest' });
    const retrying = new ModulesService(other.hub, failing);
    await retrying.normalize('w');
    await retrying.normalize('w');
    expect(failing.latestVersion).toHaveBeenCalledTimes(1);
  });
});
