import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  defaultSettings,
  THEME_SCHEMA_VERSION,
  type ThemeData,
  type ThemeSnapshot,
} from '../../shared/settings';
import { SETTINGS_VERSION } from './service';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => Promise<unknown>>,
  pickFile: vi.fn<() => Promise<string | undefined>>(),
  pickSave: vi.fn<() => Promise<string | undefined>>(),
  confirm: vi.fn<(windowId: string, options: { detail: string }) => Promise<boolean>>(),
  openPath: vi.fn<(target: string) => Promise<string>>(),
  showItemInFolder: vi.fn<(file: string) => void>(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/documents' },
  shell: { openPath: mocks.openPath, showItemInFolder: mocks.showItemInFolder },
}));
vi.mock('../../ipc/main', () => ({
  Settings: {},
  implement: (_iface: unknown, _contents: unknown, handlers: typeof mocks.handlers) => {
    mocks.handlers = handlers;
  },
}));
vi.mock('../dialogs', () => ({
  pickFile: mocks.pickFile,
  pickSave: mocks.pickSave,
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
const service = {
  settings: defaultSettings,
  replace: vi.fn(() => 7),
  set: vi.fn((_key: string, _value: unknown) => 8),
  exportData: () => ({ schemaVersion: SETTINGS_VERSION, editorFontSize: 18 }),
};
const store = { file: '', flush: vi.fn(async () => undefined) };
const context = {
  service,
  store,
  themes: [] as ThemeData[],
  themesDir: '',
  refreshThemes: vi.fn(async () => 3),
};

async function importFile(content: string): Promise<unknown> {
  const file = path.join(dir, 'imported.json');
  await fsp.writeFile(file, content);
  mocks.pickFile.mockResolvedValue(file);
  return mocks.handlers.ImportSettings!();
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fsp.readFile(file, 'utf8')) as unknown;
}

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'fiddle-settings-ipc-'));
  vi.clearAllMocks();
  mocks.confirm.mockResolvedValue(true);
  mocks.openPath.mockResolvedValue('');
  store.file = path.join(dir, 'settings.json');
  context.themes = [];
  context.themesDir = path.join(dir, 'themes');
  bindSettingsIpc({
    contents: {},
    windowId: 'w',
    services: { settings: context },
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

  it('resets the settings the file does not mention, but keeps crash reports', async () => {
    service.settings = { ...defaultSettings, crashReports: false, showObsolete: true };
    try {
      await importFile('{"editorFontSize":18}');
      expect(service.replace).toHaveBeenCalledWith({
        ...defaultSettings,
        crashReports: false,
        editorFontSize: 18,
      });
      expect(mocks.confirm).not.toHaveBeenCalled();

      service.replace.mockClear();
      await importFile('{"crashReports":true}');
      expect(service.replace).toHaveBeenCalledWith(defaultSettings);
    } finally {
      service.settings = defaultSettings;
    }
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

describe('OpenSettingsFile', () => {
  it('flushes pending writes, creates a file with only the schema version if there is none, and opens it', async () => {
    await mocks.handlers.OpenSettingsFile!();
    expect(store.flush).toHaveBeenCalledOnce();
    expect(await readJson(store.file)).toEqual({ schemaVersion: SETTINGS_VERSION });
    expect(mocks.openPath).toHaveBeenCalledWith(store.file);
  });

  it('leaves an existing file as it is', async () => {
    await fsp.writeFile(store.file, '{"schemaVersion":1,"editorFontSize":18}');
    await mocks.handlers.OpenSettingsFile!();
    expect(await readJson(store.file)).toEqual({ schemaVersion: 1, editorFontSize: 18 });
  });

  it("fails with unavailable, naming the file and the shell's reason, when nothing can open it", async () => {
    mocks.openPath.mockResolvedValue('No application');
    await expect(mocks.handlers.OpenSettingsFile!()).rejects.toMatchObject({
      code: 'unavailable',
      message: `openFailed:${store.file},No application`,
    });
  });
});

describe('ExportSettings', () => {
  it('writes the exported settings as formatted JSON to the chosen file', async () => {
    const file = path.join(dir, 'export.json');
    mocks.pickSave.mockResolvedValue(file);
    await mocks.handlers.ExportSettings!();
    expect(await fsp.readFile(file, 'utf8')).toBe(
      `${JSON.stringify(service.exportData(), null, 2)}\n`,
    );
  });

  it('writes nothing when the save dialog is cancelled', async () => {
    mocks.pickSave.mockResolvedValue(undefined);
    await mocks.handlers.ExportSettings!();
    expect(await fsp.readdir(dir)).toEqual([]);
  });
});

describe('ImportTheme', () => {
  const monaco = { base: 'vs-dark', inherit: true, rules: [], colors: {} };

  async function importTheme(name: string, content: string): Promise<unknown> {
    const file = path.join(dir, name);
    await fsp.writeFile(file, content);
    mocks.pickFile.mockResolvedValue(file);
    return mocks.handlers.ImportTheme!();
  }

  it('saves a Monaco theme under the file name, selects it and returns the new rev, without revealing it', async () => {
    expect(await importTheme('Night Owl.json', JSON.stringify(monaco))).toBe(8);
    expect(await readJson(path.join(context.themesDir, 'night-owl.json'))).toEqual({
      schemaVersion: THEME_SCHEMA_VERSION,
      name: 'Night Owl',
      isDark: true,
      editor: monaco,
      common: {},
    });
    expect(context.refreshThemes).toHaveBeenCalledOnce();
    expect(service.set).toHaveBeenCalledWith('theme', 'night-owl');
    expect(mocks.showItemInFolder).not.toHaveBeenCalled();
  });

  it('picks a fresh ID instead of overwriting a theme file that is already there', async () => {
    await fsp.mkdir(context.themesDir);
    await fsp.writeFile(path.join(context.themesDir, 'night-owl.json'), '{}');
    await importTheme('Night Owl.json', JSON.stringify(monaco));
    expect(service.set).toHaveBeenCalledWith('theme', 'night-owl-2');
    expect(await readJson(path.join(context.themesDir, 'night-owl.json'))).toEqual({});
  });

  it('rejects JSON that is not a Monaco theme with invalidArgument, naming the file', async () => {
    await expect(importTheme('nope.json', '{"colors":{}}')).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'notTheme:nope.json',
    });
    expect(service.set).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    mocks.pickFile.mockResolvedValue(undefined);
    expect(await mocks.handlers.ImportTheme!()).toBeNull();
    expect(context.refreshThemes).not.toHaveBeenCalled();
  });
});

describe('CreateTheme', () => {
  const snapshot: ThemeSnapshot = {
    isDark: true,
    editor: { base: 'vs-dark', inherit: true, rules: [] },
    common: { accent: '#ff0000' },
  };

  it('copies the current custom theme under a "copy" name, selects it and reveals the file', async () => {
    context.themes = [
      {
        id: 'night-owl',
        name: 'Night Owl',
        isDark: true,
        editor: snapshot.editor,
        common: {},
      },
    ];
    service.settings = { ...defaultSettings, theme: 'night-owl' };
    try {
      expect(await mocks.handlers.CreateTheme!(null)).toBe(8);
    } finally {
      service.settings = defaultSettings;
    }
    const file = path.join(context.themesDir, 'themecopyname-night-owl.json');
    expect(await readJson(file)).toMatchObject({
      name: 'themeCopyName:Night Owl',
      isDark: true,
      editor: snapshot.editor,
    });
    expect(service.set).toHaveBeenCalledWith('theme', 'themecopyname-night-owl');
    expect(mocks.showItemInFolder).toHaveBeenCalledWith(file);
  });

  it.each([
    ['dark', { ...snapshot }, 'lucentDark'],
    ['light', { ...snapshot, isDark: false }, 'lucentLight'],
    [
      'high-contrast dark',
      { ...snapshot, editor: { ...snapshot.editor, base: 'hc-black' as const } },
      'lucentHcDark',
    ],
    [
      'high-contrast light',
      {
        ...snapshot,
        isDark: false,
        editor: { ...snapshot.editor, base: 'hc-light' as const },
      },
      'lucentHcLight',
    ],
  ])(
    "starts from the renderer's snapshot of the %s built-in theme, named after it",
    async (_name, builtin, key) => {
      await mocks.handlers.CreateTheme!(builtin);
      const [file] = await fsp.readdir(context.themesDir);
      expect(await readJson(path.join(context.themesDir, file!))).toMatchObject({
        name: `themeCopyName:${key}`,
        isDark: builtin.isDark,
        editor: builtin.editor,
        common: builtin.common,
      });
    },
  );

  it('needs either a current custom theme or a snapshot', async () => {
    await expect(mocks.handlers.CreateTheme!(null)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(service.set).not.toHaveBeenCalled();
  });
});

it('OpenThemesFolder creates the themes folder before opening it', async () => {
  await mocks.handlers.OpenThemesFolder!();
  expect((await fsp.stat(context.themesDir)).isDirectory()).toBe(true);
  expect(mocks.openPath).toHaveBeenCalledWith(context.themesDir);
});

it('GetTheme returns the theme with that ID, or null', async () => {
  context.themes = [{ id: 'night-owl', name: 'Night Owl', isDark: true, common: {} }];
  expect(await mocks.handlers.GetTheme!('night-owl')).toMatchObject({
    name: 'Night Owl',
  });
  expect(await mocks.handlers.GetTheme!('gone')).toBeNull();
});
