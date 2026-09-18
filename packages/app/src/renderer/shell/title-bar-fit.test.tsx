// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import type { Platform } from '../../shared/stores';
import {
  capsuleWidth,
  leftGroupMin,
  rightGroupMin,
  TITLE_BAR_PARTS,
  titleBarFit,
  type TitleBarFit,
} from './title-bar-fit';

/** The least width the title bar needs with what `fit` shows. */
function titleBarMinWidth(
  platform: Platform,
  menuBar: boolean,
  fit: TitleBarFit,
): number {
  const parts = TITLE_BAR_PARTS;
  return (
    leftGroupMin(platform, menuBar) +
    capsuleWidth(parts.pickerMin, fit.runHint ? parts.run[platform] : parts.runBare) +
    rightGroupMin(
      platform,
      fit.publishLabel ? parts.publishLabelled : parts.iconButton,
      fit.openGistButton,
    )
  );
}

const PLATFORMS: readonly Platform[] = ['darwin', 'win32', 'linux'];
/** The window's minimum width. */
const MIN_WIDTH = 600;

describe('titleBarFit', () => {
  it('never needs more than the narrowest window, on any platform, with or without the menu bar', () => {
    for (const platform of PLATFORMS) {
      for (const menuBar of [true, false]) {
        for (const width of [600, 640, 700, 800, 1000, 1280]) {
          const fit = titleBarFit(platform, width, menuBar);
          expect(
            titleBarMinWidth(platform, menuBar, fit),
            `${platform} at ${width} (menu bar ${menuBar})`,
          ).toBeLessThanOrEqual(width);
        }
      }
    }
    expect(titleBarMinWidth('win32', true, titleBarFit('win32', MIN_WIDTH, true))).toBe(
      MIN_WIDTH,
    );
  });

  it('shows everything in the default window and gives things up only as it narrows', () => {
    const full = { publishLabel: true, openGistButton: true, runHint: true };
    for (const platform of PLATFORMS)
      expect(titleBarFit(platform, 1280, true)).toEqual(full);
    // Linux: the Publish label goes below 674.
    expect(titleBarFit('linux', 674, true)).toEqual(full);
    expect(titleBarFit('linux', 673, true)).toEqual({ ...full, publishLabel: false });
    expect(titleBarFit('linux', MIN_WIDTH, true)).toEqual({
      ...full,
      publishLabel: false,
    });
    // macOS has no menu bar: the label goes below 696 (736 when a test or dev run forces the bar).
    expect(titleBarFit('darwin', 696, false)).toEqual(full);
    expect(titleBarFit('darwin', 695, false).publishLabel).toBe(false);
    expect(titleBarFit('darwin', 735, true).publishLabel).toBe(false);
    expect(titleBarFit('darwin', MIN_WIDTH, true)).toEqual({
      ...full,
      publishLabel: false,
    });
    // Windows keeps 140px for its caption buttons: the label goes below 814, Open gist and the Run hint below 652.
    expect(titleBarFit('win32', 1000, true)).toEqual(full);
    expect(titleBarFit('win32', 813, true)).toEqual({ ...full, publishLabel: false });
    expect(titleBarFit('win32', 652, true)).toEqual({ ...full, publishLabel: false });
    expect(titleBarFit('win32', 651, true)).toEqual({
      publishLabel: false,
      openGistButton: false,
      runHint: false,
    });
  });

  it('gives things up in order: the Publish label before the Open gist button and the Run hint', () => {
    for (const platform of PLATFORMS) {
      for (let width = 1280; width >= MIN_WIDTH; width -= 4) {
        const fit = titleBarFit(platform, width, true);
        if (fit.openGistButton || fit.runHint)
          expect(fit.openGistButton && fit.runHint).toBe(true);
        if (!fit.openGistButton)
          expect(fit.publishLabel, `${platform} at ${width}`).toBe(false);
      }
    }
  });
});
