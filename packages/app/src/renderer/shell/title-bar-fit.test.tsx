import { describe, expect, it } from 'vitest';

import type { Platform } from '../../shared/stores';
import { titleBarFit } from './title-bar-fit';

const PLATFORMS: readonly Platform[] = ['darwin', 'win32', 'linux'];
/** The window's minimum width. */
const MIN_WIDTH = 600;
const full = { publishLabel: true, openGistButton: true, runHint: true };
const noLabel = { ...full, publishLabel: false };
const bare = { publishLabel: false, openGistButton: false, runHint: false };

describe('titleBarFit', () => {
  it('shows everything in the default window and gives things up only as it narrows', () => {
    for (const platform of PLATFORMS)
      expect(titleBarFit(platform, 1280, true)).toEqual(full);
    for (const [platform, width, menuBar, fit] of [
      // Linux: the Publish label goes below 674 (634 without the menu bar).
      ['linux', 674, true, full],
      ['linux', 673, true, noLabel],
      ['linux', 634, false, full],
      ['linux', MIN_WIDTH, true, noLabel],
      // macOS has no menu bar: the label goes below 696 (736 when a test or dev run forces the bar).
      ['darwin', 696, false, full],
      ['darwin', 695, false, noLabel],
      ['darwin', 735, true, noLabel],
      ['darwin', MIN_WIDTH, true, noLabel],
      // Windows keeps 140px for its caption buttons: the label goes below 814, Open gist and the Run hint below 652.
      ['win32', 1000, true, full],
      ['win32', 813, true, noLabel],
      ['win32', 774, false, full],
      ['win32', 652, true, noLabel],
      ['win32', 651, true, bare],
      ['win32', 612, false, noLabel],
      ['win32', MIN_WIDTH, false, bare],
    ] as const)
      expect(titleBarFit(platform, width, menuBar), `${platform} at ${width}`).toEqual(
        fit,
      );
  });

  it('gives things up in order: the Publish label before the Open gist button and the Run hint', () => {
    for (const platform of PLATFORMS) {
      for (let width = 1280; width >= MIN_WIDTH; width -= 4) {
        const fit = titleBarFit(platform, width, true);
        expect(fit.openGistButton).toBe(fit.runHint);
        if (!fit.openGistButton)
          expect(fit.publishLabel, `${platform} at ${width}`).toBe(false);
      }
    }
  });
});
