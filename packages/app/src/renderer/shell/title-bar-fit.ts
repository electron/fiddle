/**
 * What gives way in a narrow title bar (the window is at least 600px wide), before the capsule's version picker
 * narrows: the Publish label, then the Open gist button and Run's key hint. The widths are the px the parts' CSS
 * adds up to, with room in the labels for long translations.
 */
import type { Platform } from '../../shared/stores';

/** Fixed widths of the title bar's parts, in px, as the components' CSS lays them out. */
export const TITLE_BAR_PARTS = { padding: 12, gap: 12, picker: 180 } as const;

export interface TitleBarFit {
  /** Publish shows its label; otherwise it's an icon button with a tooltip. */
  publishLabel: boolean;
  /** The Open gist button is in the title bar (Open gist stays in File, the palette and the gist menu). */
  openGistButton: boolean;
  /** Run shows its key hint and keeps its no-jump floor. */
  runHint: boolean;
}

/**
 * The narrowest window, without and with a menu bar, where Publish keeps its label: both groups at their least
 * (macOS starts after the traffic lights, Windows ends before its caption buttons) beside the whole capsule.
 */
const PUBLISH_LABEL_FROM: Record<Platform, readonly [number, number]> = {
  darwin: [696, 736],
  linux: [634, 674],
  win32: [774, 814],
};
/** Below this, Windows also drops Open gist and the Run hint; the others fit them down to 600. */
const WIN32_ROOMY_FROM = [612, 652] as const;

/** What the title bar shows at `width` px. */
export function titleBarFit(
  platform: Platform,
  width: number,
  menuBar: boolean,
): TitleBarFit {
  const i = menuBar ? 1 : 0;
  const roomy = platform !== 'win32' || width >= WIN32_ROOMY_FROM[i];
  return {
    publishLabel: width >= PUBLISH_LABEL_FROM[platform][i],
    openGistButton: roomy,
    runHint: roomy,
  };
}
