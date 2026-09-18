import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../shared/settings';
import { DEFAULT_LAYOUT, type AppState } from '../shared/stores';
import { CommandRegistry } from './commands';
import { emptyFiddleState } from './documents/model';
import { StateHub } from './state-hub';

const appInit = (dev: boolean): Omit<AppState, 'rev'> => ({
  locale: 'en',
  platform: 'linux',
  material: 'none',
  settings: defaultSettings,
  themes: [],
  screenReaderActive: false,
  storageNotices: [],
  dev,
});

function setup({ dev = false } = {}) {
  const hub = new StateHub(appInit(dev));
  const windowId = randomUUID();
  hub.registerWindow(
    windowId,
    {
      title: 'Fiddle',
      view: 'editor',
      fiddle: emptyFiddleState(),
      layout: DEFAULT_LAYOUT,
    },
    { pushApp: vi.fn(), pushWindow: vi.fn() },
  );
  return { registry: new CommandRegistry(hub), windowId };
}

describe('CommandRegistry.run', () => {
  it('runs an enabled command with its context', async () => {
    const { registry, windowId } = setup();
    const handler = vi.fn();
    registry.register('view.reload', handler);
    await registry.run('view.reload', { windowId });
    expect(handler).toHaveBeenCalledExactlyOnceWith({ windowId });
  });

  it('rejects an unknown ID, whatever the renderer sends', async () => {
    const { registry, windowId } = setup();
    for (const id of ['', 'view.nope', '__proto__', 'constructor']) {
      await expect(registry.run(id, { windowId })).rejects.toMatchObject({
        code: 'not-found',
      });
    }
  });

  it('rejects a known command that has no handler', async () => {
    const { registry, windowId } = setup();
    await expect(registry.run('view.reload', { windowId })).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  it('rejects a disabled command without calling its handler', async () => {
    const { registry, windowId } = setup();
    const handler = vi.fn();
    registry.register('view.reload', handler);
    registry.register('gist.history', handler);

    // It needs a window; and this window has no gist.
    await expect(
      registry.run('view.reload', { windowId: undefined }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      registry.run('view.reload', { windowId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(registry.run('gist.history', { windowId })).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps dev-only commands off outside development builds', async () => {
    const handler = vi.fn();
    const packaged = setup();
    packaged.registry.register('dev.toggleMenuBar', handler);
    await expect(
      packaged.registry.run('dev.toggleMenuBar', { windowId: packaged.windowId }),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect(handler).not.toHaveBeenCalled();

    const dev = setup({ dev: true });
    dev.registry.register('dev.toggleMenuBar', handler);
    await dev.registry.run('dev.toggleMenuBar', { windowId: dev.windowId });
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('CommandRegistry.isEnabled', () => {
  it('is false for a command without a handler', () => {
    const { registry, windowId } = setup();
    expect(registry.isEnabled('view.reload', windowId)).toBe(false);
    registry.register('view.reload', vi.fn());
    expect(registry.isEnabled('view.reload', windowId)).toBe(true);
  });
});
