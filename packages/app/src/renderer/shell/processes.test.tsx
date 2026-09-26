import { describe, expect, it } from 'vitest';

import { processOf, splitTarget } from './processes';

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
