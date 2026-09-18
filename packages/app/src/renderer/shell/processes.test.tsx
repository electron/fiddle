import { describe, expect, it } from 'vitest';

import {
  groupByProcess,
  PROCESS_ORDER,
  processOf,
  splitTarget,
  suggestFileName,
} from './processes';

describe('processOf', () => {
  it('puts the main entry and main-* helpers under main', () => {
    expect(processOf('main.js')).toBe('main');
    expect(processOf('main.mjs')).toBe('main');
    expect(processOf('Main.CJS')).toBe('main');
    expect(processOf('main-menu.js')).toBe('main');
    expect(processOf('main.menu.mjs')).toBe('main');
  });

  it('puts preload scripts under preload', () => {
    expect(processOf('preload.js')).toBe('preload');
    expect(processOf('Preload.CJS')).toBe('preload');
    expect(processOf('preload-2.js')).toBe('preload');
    expect(processOf('preload.isolated.js')).toBe('preload');
  });

  it('puts pages, style sheets and renderer scripts under renderer', () => {
    expect(processOf('renderer.js')).toBe('renderer');
    expect(processOf('renderer-2.mjs')).toBe('renderer');
    expect(processOf('renderer.dom.js')).toBe('renderer');
    expect(processOf('index.html')).toBe('renderer');
    expect(processOf('About.HTML')).toBe('renderer');
    expect(processOf('styles.css')).toBe('renderer');
  });

  it('puts everything else under other', () => {
    expect(processOf('util.js')).toBe('other');
    expect(processOf('worker.mjs')).toBe('other');
    expect(processOf('data.json')).toBe('other');
    expect(processOf('main-data.json')).toBe('other');
    expect(processOf('mainly.js')).toBe('other');
    expect(processOf('preloader.js')).toBe('other');
    expect(processOf('my-renderer.js')).toBe('other');
  });

  it('lists other last', () => {
    expect(PROCESS_ORDER).toEqual(['main', 'preload', 'renderer', 'other']);
  });
});

describe('groupByProcess', () => {
  it('keeps order and lists every process', () => {
    const files = [
      'main.js',
      'index.html',
      'data.json',
      'preload.js',
      'renderer.js',
      'helpers.js',
    ].map((name) => ({ name }));
    expect(groupByProcess(files)).toEqual({
      main: [{ name: 'main.js' }],
      preload: [{ name: 'preload.js' }],
      renderer: [{ name: 'index.html' }, { name: 'renderer.js' }],
      other: [{ name: 'data.json' }, { name: 'helpers.js' }],
    });
    expect(groupByProcess([])).toEqual({
      main: [],
      preload: [],
      renderer: [],
      other: [],
    });
  });
});

describe('suggestFileName', () => {
  it("suggests the group's own name when it is free", () => {
    expect(suggestFileName('preload', ['main.js', 'index.html'])).toBe('preload.js');
    expect(suggestFileName('renderer', ['main.js', 'index.html'])).toBe('renderer.js');
  });

  it('numbers from 2 when the name is taken, in any case', () => {
    expect(suggestFileName('preload', ['main.js', 'Preload.js'])).toBe('preload-2.js');
    expect(
      suggestFileName('renderer', [
        'main.js',
        'renderer.js',
        'renderer-2.js',
        'RENDERER-3.JS',
      ]),
    ).toBe('renderer-4.js');
  });

  it('never suggests a second main entry', () => {
    expect(suggestFileName('main', ['main.js'])).toBe('main-2.js');
    expect(suggestFileName('main', ['main.cjs', 'main-2.js'])).toBe('main-3.js');
    expect(suggestFileName('main', ['index.html'])).toBe('main.js');
  });

  it('has no suggestion for other', () => {
    expect(suggestFileName('other', ['main.js'])).toBe('');
  });

  it('suggests names that land in the group', () => {
    for (const process of ['main', 'preload', 'renderer'] as const) {
      expect(
        processOf(suggestFileName(process, ['main.js', 'preload.js', 'renderer.js'])),
      ).toBe(process);
    }
  });
});

describe('splitTarget', () => {
  const names = ['main.js', 'preload.js', 'renderer.js', 'index.html'];
  it('opens renderer.js, or main.js when renderer.js is current', () => {
    expect(splitTarget('main.js', names)).toBe('renderer.js');
    expect(splitTarget('index.html', names)).toBe('renderer.js');
    expect(splitTarget('renderer.js', names)).toBe('main.js');
  });
  it('falls back to another file', () => {
    expect(splitTarget('main.js', ['main.js', 'index.html'])).toBe('index.html');
    expect(splitTarget('main.js', ['main.js'])).toBeNull();
    expect(splitTarget(null, [])).toBeNull();
  });
});
