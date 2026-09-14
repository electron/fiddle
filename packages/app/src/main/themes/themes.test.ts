import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { FiddleError } from '../../shared/errors';
import { HIGH_CONTRAST_THEMES, THEME_SCHEMA_VERSION, type ThemeFile } from '../../shared/settings';
import { log } from '../log';
import { loadThemes, parseTheme, themeFromMonaco, themeId, themeSource, writeTheme } from './themes';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'themes-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const valid = {
  name: 'Night',
  isDark: true,
  editor: { base: 'vs-dark', inherit: true, rules: [{ token: 'comment', foreground: '5c6773' }], colors: {} },
  common: { accent: '#ff8800', 'font-mono': '"Fira Code", monospace' },
};

const mine: ThemeFile = {
  name: 'Mine',
  isDark: false,
  editor: { base: 'hc-light', inherit: true, rules: [{ token: 'keyword', foreground: '0f4a85' }], colors: {} },
  common: { accent: '#0f4a85', ink: '#000000' },
};

describe('parseTheme', () => {
  // @feature themes.custom themes.custom-meta themes.custom-editor themes.custom-tokens
  it('accepts a valid theme and adds its ID', () => {
    expect(parseTheme('night', JSON.stringify(valid))).toEqual({ ...valid, id: 'night' });
  });

  // @feature themes.custom-tokens
  it('rejects url( in tokens, bad colours and bad JSON', () => {
    expect(parseTheme('x', JSON.stringify({ ...valid, common: { accent: 'url(https://evil)' } }))).toBeUndefined();
    expect(
      parseTheme('x', JSON.stringify({ ...valid, editor: { base: 'vs', colors: { a: 'url(x)' } } })),
    ).toBeUndefined();
    expect(parseTheme('x', '{')).toBeUndefined();
    expect(parseTheme('x', JSON.stringify({ name: 'No mode' }))).toBeUndefined();
  });

  it('shows a theme from a newer version as far as it understands it', () => {
    const newer = { ...valid, schemaVersion: THEME_SCHEMA_VERSION + 1 };
    expect(parseTheme('night', JSON.stringify(newer))).toEqual({ ...newer, id: 'night' });
    expect(log.warn).toHaveBeenCalledWith('theme is from a newer version', 'night');
  });
});

describe('themeFromMonaco', () => {
  // @feature themes.import
  it('needs base or rules', () => {
    expect(() => themeFromMonaco('x', { colors: {} })).toThrow(FiddleError);
    expect(() => themeFromMonaco('x', 'nope')).toThrow(FiddleError);
  });

  // @feature themes.import
  it('works out light or dark', () => {
    expect(themeFromMonaco('a', { base: 'vs' }).isDark).toBe(false);
    expect(themeFromMonaco('a', { base: 'hc-black' }).isDark).toBe(true);
    expect(themeFromMonaco('a', { rules: [], colors: { 'editor.background': '#fafafa' } }).isDark).toBe(false);
    expect(themeFromMonaco('a', { rules: [], colors: { 'editor.background': '#101010' } }).isDark).toBe(true);
    expect(themeFromMonaco('Solarized', { base: 'vs' })).toMatchObject({ name: 'Solarized', common: {} });
  });
});

describe('files', () => {
  // @feature themes.custom
  it('loads valid themes, skips invalid ones and built-in IDs, and sorts by name', async () => {
    await writeFile(path.join(dir, 'night.json'), JSON.stringify(valid));
    await writeFile(path.join(dir, 'aurora.json'), JSON.stringify({ ...valid, name: 'Aurora' }));
    await writeFile(path.join(dir, 'broken.json'), '{');
    await writeFile(path.join(dir, `${HIGH_CONTRAST_THEMES.dark}.json`), JSON.stringify(valid));
    await writeFile(path.join(dir, 'notes.txt'), 'hi');
    const themes = await loadThemes(dir);
    expect(themes.map((theme) => theme.id)).toEqual(['aurora', 'night']);
    expect(await loadThemes(path.join(dir, 'missing'))).toEqual([]);
  });

  // @feature themes.create
  it('writes new theme files with a schemaVersion, and never overwrites', async () => {
    const file = await writeTheme(dir, 'mine', mine);
    const written = JSON.parse(await readFile(file, 'utf8'));
    expect(written).toEqual({ schemaVersion: THEME_SCHEMA_VERSION, ...mine });
    expect(Object.keys(written)[0]).toBe('schemaVersion');
    await expect(writeTheme(dir, 'mine', { ...mine, name: 'Other' })).rejects.toMatchObject({ code: 'EEXIST' });
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ name: 'Mine' });
  });

  // @feature themes.create
  it('round-trips a theme through its file', async () => {
    await writeTheme(dir, 'mine', { ...mine, schemaVersion: 99 });
    const [loaded] = await loadThemes(dir);
    expect(loaded).toEqual({ ...mine, schemaVersion: THEME_SCHEMA_VERSION, id: 'mine' });
    // Written again (e.g. "Create from current" on it), it's the same file.
    const { id: _id, ...again } = loaded!;
    await writeTheme(dir, 'mine-2', again);
    expect(await readFile(path.join(dir, 'mine-2.json'), 'utf8')).toBe(await readFile(path.join(dir, 'mine.json'), 'utf8'));
  });

  it('makes unique, file-safe IDs that never name a built-in theme', () => {
    expect(themeId('Solarized Dark!', new Set())).toBe('solarized-dark');
    expect(themeId('Solarized Dark', new Set(['solarized-dark']))).toBe('solarized-dark-2');
    expect(themeId('Lucent', new Set())).toBe('lucent-custom');
    expect(themeId('Lucent HC dark', new Set())).toBe('lucent-hc-dark-custom');
    expect(themeId('✨', new Set())).toBe('theme');
  });
});

// @feature themes.native-mode themes.builtin
it('picks the native theme source', () => {
  const themes = [{ id: 'night', name: 'Night', isDark: true }];
  expect(themeSource({ appearance: 'system', theme: 'lucent' }, themes)).toBe('system');
  expect(themeSource({ appearance: 'light', theme: 'lucent' }, themes)).toBe('light');
  expect(themeSource({ appearance: 'light', theme: 'night' }, themes)).toBe('dark');
  expect(themeSource({ appearance: 'dark', theme: 'gone' }, themes)).toBe('dark');
  expect(themeSource({ appearance: 'light', theme: HIGH_CONTRAST_THEMES.dark }, themes)).toBe('dark');
  expect(themeSource({ appearance: 'dark', theme: HIGH_CONTRAST_THEMES.light }, themes)).toBe('light');
});
