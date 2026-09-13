import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { FiddleError } from '../../shared/errors';
import {
  builtinThemeFile,
  loadThemes,
  parseTheme,
  themeFromMonaco,
  themeId,
  themeSource,
  writeTheme,
} from './themes';

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

describe('parseTheme', () => {
  it('accepts a valid theme and adds its ID', () => {
    expect(parseTheme('night', JSON.stringify(valid))).toEqual({ ...valid, id: 'night' });
  });

  it('rejects url( in tokens, bad colours and bad JSON', () => {
    expect(parseTheme('x', JSON.stringify({ ...valid, common: { accent: 'url(https://evil)' } }))).toBeUndefined();
    expect(
      parseTheme('x', JSON.stringify({ ...valid, editor: { base: 'vs', colors: { a: 'url(x)' } } })),
    ).toBeUndefined();
    expect(parseTheme('x', '{')).toBeUndefined();
    expect(parseTheme('x', JSON.stringify({ name: 'No mode' }))).toBeUndefined();
  });
});

describe('themeFromMonaco', () => {
  it('needs base or rules', () => {
    expect(() => themeFromMonaco('x', { colors: {} })).toThrow(FiddleError);
    expect(() => themeFromMonaco('x', 'nope')).toThrow(FiddleError);
  });

  it('works out light or dark', () => {
    expect(themeFromMonaco('a', { base: 'vs' }).isDark).toBe(false);
    expect(themeFromMonaco('a', { base: 'hc-black' }).isDark).toBe(true);
    expect(themeFromMonaco('a', { rules: [], colors: { 'editor.background': '#fafafa' } }).isDark).toBe(false);
    expect(themeFromMonaco('a', { rules: [], colors: { 'editor.background': '#101010' } }).isDark).toBe(true);
    expect(themeFromMonaco('Solarized', { base: 'vs' })).toMatchObject({ name: 'Solarized', common: {} });
  });
});

describe('files', () => {
  it('loads valid themes, skips invalid ones and sorts by name', async () => {
    await writeFile(path.join(dir, 'night.json'), JSON.stringify(valid));
    await writeFile(path.join(dir, 'aurora.json'), JSON.stringify({ ...valid, name: 'Aurora' }));
    await writeFile(path.join(dir, 'broken.json'), '{');
    await writeFile(path.join(dir, 'notes.txt'), 'hi');
    const themes = await loadThemes(dir);
    expect(themes.map((theme) => theme.id)).toEqual(['aurora', 'night']);
    expect(await loadThemes(path.join(dir, 'missing'))).toEqual([]);
  });

  it('writes new theme files and never overwrites', async () => {
    const file = await writeTheme(dir, 'mine', builtinThemeFile('Mine', false));
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ name: 'Mine', isDark: false });
    await expect(writeTheme(dir, 'mine', builtinThemeFile('Other', true))).rejects.toThrow();
    expect(parseTheme('mine', await readFile(file, 'utf8'))).toBeDefined();
  });

  it('makes unique, file-safe IDs', () => {
    expect(themeId('Solarized Dark!', new Set())).toBe('solarized-dark');
    expect(themeId('Solarized Dark', new Set(['solarized-dark']))).toBe('solarized-dark-2');
    expect(themeId('Lucent', new Set())).toBe('lucent-custom');
    expect(themeId('✨', new Set())).toBe('theme');
  });
});

it('picks the native theme source', () => {
  const themes = [{ id: 'night', name: 'Night', isDark: true }];
  expect(themeSource({ appearance: 'system', theme: 'lucent' }, themes)).toBe('system');
  expect(themeSource({ appearance: 'light', theme: 'lucent' }, themes)).toBe('light');
  expect(themeSource({ appearance: 'light', theme: 'night' }, themes)).toBe('dark');
  expect(themeSource({ appearance: 'dark', theme: 'gone' }, themes)).toBe('dark');
});
