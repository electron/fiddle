import { describe, expect, it } from 'vitest';

import { groupByProcess, processOf, splitTarget } from './processes';

describe('processOf', () => {
  it('sorts files into processes', () => {
    expect(processOf('main.js')).toBe('main');
    expect(processOf('main.mjs')).toBe('main');
    expect(processOf('preload.js')).toBe('preload');
    expect(processOf('Preload.CJS')).toBe('preload');
    expect(processOf('renderer.js')).toBe('renderer');
    expect(processOf('index.html')).toBe('renderer');
    expect(processOf('styles.css')).toBe('renderer');
    expect(processOf('util.js')).toBe('renderer');
  });
});

describe('groupByProcess', () => {
  it('keeps order and lists every process', () => {
    const files = ['main.js', 'index.html', 'preload.js', 'renderer.js'].map((name) => ({ name }));
    expect(groupByProcess(files)).toEqual({
      main: [{ name: 'main.js' }],
      preload: [{ name: 'preload.js' }],
      renderer: [{ name: 'index.html' }, { name: 'renderer.js' }],
    });
    expect(groupByProcess([])).toEqual({ main: [], preload: [], renderer: [] });
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
