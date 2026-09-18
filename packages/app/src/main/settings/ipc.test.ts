import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../../shared/settings';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => Promise<unknown>>,
  pickFile: vi.fn<() => Promise<string | undefined>>(),
  confirm: vi.fn<(windowId: string, options: { detail: string }) => Promise<boolean>>(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/documents' },
  shell: { openPath: vi.fn(async () => ''), showItemInFolder: vi.fn() },
}));
vi.mock('../../ipc/main', () => ({
  Settings: {},
  implement: (_iface: unknown, _contents: unknown, handlers: typeof mocks.handlers) => {
    mocks.handlers = handlers;
  },
}));
vi.mock('../dialogs', () => ({
  pickFile: mocks.pickFile,
  pickSave: vi.fn(),
  confirm: mocks.confirm,
}));
vi.mock('../i18n', () => ({
  tm: () => (key: string, options?: Record<string, string>) =>
    options ? `${key}:${Object.values(options).join(',')}` : key,
}));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { bindSettingsIpc } from './ipc';

let dir: string;
const service = { settings: defaultSettings, replace: vi.fn(() => 7) };

async function importFile(content: string): Promise<unknown> {
  const file = path.join(dir, 'imported.json');
  await fsp.writeFile(file, content);
  mocks.pickFile.mockResolvedValue(file);
  return mocks.handlers.ImportSettings!();
}

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'fiddle-settings-ipc-'));
  service.replace.mockClear();
  mocks.confirm.mockReset().mockResolvedValue(true);
  bindSettingsIpc({
    contents: {},
    windowId: 'w',
    services: { settings: { service, store: {}, themes: [], themesDir: dir } },
  } as never);
});

afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('ImportSettings', () => {
  it('rejects text that is not JSON, and JSON that is not an object, naming the file', async () => {
    await expect(importFile('{oops')).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('imported.json'),
    });
    await expect(importFile('[1,2]')).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(service.replace).not.toHaveBeenCalled();
  });

  it('applies a harmless file without asking', async () => {
    expect(await importFile('{"editorFontSize":18,"unknownKey":1}')).toBe(7);
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(service.replace).toHaveBeenCalledWith(
      expect.objectContaining({ editorFontSize: 18 }),
    );
  });

  it.each([
    ['Electron flags', '{"electronFlags":["--no-sandbox"]}', '--no-sandbox'],
    [
      'environment variables',
      '{"environmentVariables":["NODE_OPTIONS=--require=x"]}',
      'NODE_OPTIONS',
    ],
    [
      'a mirror',
      '{"mirror":"custom","customMirrorElectron":"https://mirror.example/"}',
      'https://mirror.example/',
    ],
    ['the package manager', '{"packageManager":"yarn"}', 'yarn'],
    ['Socket Firewall', '{"socketFirewall":false}', 'false'],
  ])(
    'asks before changing %s, and applies the file when confirmed',
    async (_name, file, shown) => {
      expect(await importFile(file)).toBe(7);
      expect(mocks.confirm).toHaveBeenCalledOnce();
      expect(mocks.confirm.mock.calls[0]![1].detail).toContain(shown);
      expect(service.replace).toHaveBeenCalledOnce();
    },
  );

  it('changes nothing when the confirmation is declined', async () => {
    mocks.confirm.mockResolvedValue(false);
    expect(
      await importFile('{"electronFlags":["--no-sandbox"],"editorFontSize":18}'),
    ).toBeNull();
    expect(service.replace).not.toHaveBeenCalled();
  });

  it('does not ask again for values that are already set', async () => {
    service.settings = { ...defaultSettings, socketFirewall: false };
    try {
      await importFile('{"socketFirewall":false}');
      expect(mocks.confirm).not.toHaveBeenCalled();
    } finally {
      service.settings = defaultSettings;
    }
  });
});
