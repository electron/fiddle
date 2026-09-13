import { describe, expect, it, vi } from 'vitest';

import type { FiddleState } from '../../shared/stores';
import type { ChangeListener } from '../state-hub';
import { ModulesService, type ModulesHub } from './service';

function fakeHub(modules: Record<string, string>) {
  let fiddle = { modules } as FiddleState;
  let rev = 0;
  const listeners = new Set<ChangeListener>();
  const hub: ModulesHub = {
    getWindow: (id) => (id === 'w' ? { fiddle } : undefined),
    updateWindow: (_id, patch) => {
      fiddle = patch.fiddle;
      rev += 1;
      queueMicrotask(() => listeners.forEach((l) => l({ store: 'window', windowId: 'w' })));
      return rev;
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { hub, modules: () => fiddle.modules };
}

const npm = { latestVersion: vi.fn(async (name: string) => (name === 'lodash' ? '4.17.21' : '1.2.3')) };
const log = () => {};

describe('ModulesService', () => {
  it('adds a module at its latest version', async () => {
    const { hub, modules } = fakeHub({});
    const service = new ModulesService(hub, npm, log);
    expect(await service.add('w', 'lodash')).toBe(1);
    expect(modules()).toEqual({ lodash: '4.17.21' });
  });

  it('keeps an exact version and normalizes anything else', async () => {
    const { hub, modules } = fakeHub({ a: '1.0.0' });
    const service = new ModulesService(hub, npm, log);
    await service.add('w', 'b', '2.0.0');
    await service.setVersion('w', 'a', '*');
    expect(modules()).toEqual({ a: '1.2.3', b: '2.0.0' });
  });

  it('rejects invalid names, specs and unknown modules', async () => {
    const service = new ModulesService(fakeHub({}).hub, npm, log);
    await expect(service.add('w', '../x')).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(service.add('w', 'x', 'git+https://evil')).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(service.setVersion('w', 'missing', '1.0.0')).rejects.toMatchObject({ code: 'not-found' });
    await expect(service.add('nope', 'x', '1.0.0')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('removes a module', () => {
    const { hub, modules } = fakeHub({ a: '1.0.0', b: '2.0.0' });
    new ModulesService(hub, npm, log).remove('w', 'a');
    expect(modules()).toEqual({ b: '2.0.0' });
  });

  it('normalizes loaded non-semver versions to the latest', async () => {
    const { hub, modules } = fakeHub({ lodash: '*', exact: '1.0.0', range: '^1.0.0' });
    await new ModulesService(hub, npm, log).normalize('w');
    expect(modules()).toEqual({ lodash: '4.17.21', exact: '1.0.0', range: '1.2.3' });
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
    const service = new ModulesService(hub, slow, log);
    const pending = service.normalize('w');
    hub.updateWindow('w', { fiddle: { modules: { a: '1.0.0' } } as unknown as FiddleState });
    release();
    await pending;
    expect(modules()).toEqual({ a: '1.0.0' });

    const failing = { latestVersion: vi.fn(async () => Promise.reject(new Error('offline'))) };
    const other = fakeHub({ b: 'latest' });
    const retrying = new ModulesService(other.hub, failing, log);
    await retrying.normalize('w');
    await retrying.normalize('w');
    expect(failing.latestVersion).toHaveBeenCalledTimes(1);
  });
});
