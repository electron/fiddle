/**
 * What gives way in a narrow title bar (the window is at least 600px wide), before the capsule's version picker
 * narrows: the Publish label, then the Open gist button and Run's key hint. The widths are px budgets that must
 * match the CSS, and labels get room for long translations.
 */
import type { Platform } from '../../shared/stores';

/** Fixed widths of the title bar's parts, in px, as the components' CSS lays them out. */
export const TITLE_BAR_PARTS = {
  /** The title bar's own padding, each side. */
  padding: 12,
  /** Before the sidebar button: the traffic lights on macOS (it starts at 98), else up to the 20px inset. */
  startInset: { darwin: 86, win32: 8, linux: 8 },
  /** After Settings: the caption buttons Windows draws over the title bar. */
  endInset: { darwin: 0, win32: 140, linux: 0 },
  sidebarButton: 36,
  /** Between the left group's parts, and the padding each group keeps next to the capsule. */
  gap: 12,
  /** The menu bar folded all the way: one Menu button. */
  menuButton: 28,
  /** Between the right group's buttons. */
  buttonGap: 8,
  iconButton: 36,
  /** Publish with its label, in any language (English takes about 100). */
  publishLabelled: 130,
  /** The capsule around its two controls: 3px insets and a 2px gap. */
  capsuleChrome: 8,
  picker: 180,
  pickerMin: 112,
  /** Run keeps a floor so its states don't jump; wider off macOS, where the hint reads Ctrl+R. */
  run: { darwin: 108, win32: 124, linux: 124 },
  /** Run without its key hint or floor, for its longest label. */
  runBare: 116,
} as const;

export interface TitleBarFit {
  /** Publish shows its label; otherwise it's an icon button with a tooltip. */
  publishLabel: boolean;
  /** The Open gist button is in the title bar (Open gist stays in File, the palette and the gist menu). */
  openGistButton: boolean;
  /** Run shows its key hint and keeps its no-jump floor. */
  runHint: boolean;
}

const P = TITLE_BAR_PARTS;

/** The least the left group takes: the name hidden and the menus folded into the Menu button. */
export function leftGroupMin(platform: Platform, menuBar: boolean): number {
  return (
    P.padding +
    P.startInset[platform] +
    P.sidebarButton +
    P.gap +
    (menuBar ? P.menuButton + P.gap : 0) +
    P.gap
  );
}

/** The least the right group takes with Publish `publish` px wide, with or without the Open gist button. */
export function rightGroupMin(
  platform: Platform,
  publish: number,
  openGist: boolean,
): number {
  return (
    P.gap +
    (openGist ? P.iconButton + P.buttonGap : 0) +
    publish +
    P.buttonGap +
    P.iconButton +
    P.endInset[platform] +
    P.padding
  );
}

export const capsuleWidth = (picker: number, run: number): number =>
  P.capsuleChrome + picker + run;

/**
 * What the title bar shows at `width` px. Publish keeps its label while the
 * capsule can stay whole beside both groups at their least; Open gist and the
 * Run hint stay while everything fits with the picker at its narrowest.
 */
export function titleBarFit(
  platform: Platform,
  width: number,
  menuBar: boolean,
): TitleBarFit {
  const left = leftGroupMin(platform, menuBar);
  const publishLabel =
    left +
      capsuleWidth(P.picker, P.run[platform]) +
      rightGroupMin(platform, P.publishLabelled, true) <=
    width;
  const roomy =
    left +
      capsuleWidth(P.pickerMin, P.run[platform]) +
      rightGroupMin(platform, P.iconButton, true) <=
    width;
  return { publishLabel, openGistButton: roomy, runHint: roomy };
}
