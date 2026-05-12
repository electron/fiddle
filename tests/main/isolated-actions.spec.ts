/**
 * @vitest-environment node
 */

import * as electron from 'electron';
import { describe, expect, it } from 'vitest';

import { getIsolatedRunButtonFrame } from '../../src/main/isolated-actions';

function makeWebContents(frameUrls: string[]) {
  const frames = frameUrls.map((url) => ({ url }));
  return {
    mainFrame: { framesInSubtree: frames },
  } as unknown as electron.WebContents;
}

describe('getIsolatedRunButtonFrame', () => {
  it('returns the isolated-actions:// frame when present', () => {
    const wc = makeWebContents([
      'http://localhost:3000/main_window/',
      'isolated-actions://run-button/',
    ]);
    const frame = getIsolatedRunButtonFrame(wc);
    expect(frame).not.toBeNull();
    expect(frame!.url).toBe('isolated-actions://run-button/');
  });

  it('returns null when no isolated frame is loaded', () => {
    const wc = makeWebContents(['http://localhost:3000/main_window/']);
    expect(getIsolatedRunButtonFrame(wc)).toBeNull();
  });

  it('returns null when the WebContents has no mainFrame yet', () => {
    expect(getIsolatedRunButtonFrame({} as electron.WebContents)).toBeNull();
  });

  it('ignores frames whose URLs are not isolated-actions://', () => {
    const wc = makeWebContents([
      'http://localhost:3000/main_window/',
      'about:blank',
      'http://attacker.example/',
    ]);
    expect(getIsolatedRunButtonFrame(wc)).toBeNull();
  });
});
