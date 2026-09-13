/**
 * The onboarding tour. Each step points at an element marked
 * `data-tour="<target>"`; a step whose target isn't on screen shows its card
 * in the middle of the window instead.
 */
import type onboarding from '../../../i18n/generated/en/onboarding';

export type TourTarget = 'editor' | 'version-picker' | 'run' | 'publish' | 'console' | 'sidebar';
type TourKey = keyof typeof onboarding;

export interface TourStep {
  target: TourTarget;
  title: TourKey;
  body: TourKey;
  /** Opens this file in the editor first (the Electron basics part). */
  file?: string;
}

export const MAIN_STEPS: readonly TourStep[] = [
  { target: 'editor', title: 'editorTitle', body: 'editorBody' },
  { target: 'version-picker', title: 'versionTitle', body: 'versionBody' },
  { target: 'run', title: 'runTitle', body: 'runBody' },
  { target: 'publish', title: 'publishTitle', body: 'publishBody' },
  { target: 'console', title: 'consoleTitle', body: 'consoleBody' },
  { target: 'sidebar', title: 'sidebarTitle', body: 'sidebarBody' },
  // The last step offers the optional basics.
  { target: 'editor', title: 'basicsTitle', body: 'basicsBody' },
];

export const BASICS_STEPS: readonly TourStep[] = [
  { target: 'editor', title: 'mainTitle', body: 'mainBody', file: 'main.js' },
  { target: 'editor', title: 'htmlTitle', body: 'htmlBody', file: 'index.html' },
  { target: 'editor', title: 'rendererTitle', body: 'rendererBody', file: 'renderer.js' },
];

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const CARD_WIDTH = 280;
const GAP = 12;
const MARGIN = 12;

/**
 * Where the card goes: below the target if it fits, otherwise above, otherwise
 * over its lower part (large targets like the editor), clamped to the viewport.
 */
export function placeCard(
  target: Rect | null,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const clampLeft = (left: number) =>
    Math.max(MARGIN, Math.min(left, viewport.width - card.width - MARGIN));
  if (!target) {
    return {
      top: Math.max(MARGIN, (viewport.height - card.height) / 2),
      left: clampLeft((viewport.width - card.width) / 2),
    };
  }
  const left = clampLeft(target.left);
  const below = target.top + target.height + GAP;
  if (below + card.height + MARGIN <= viewport.height) return { top: below, left };
  const above = target.top - GAP - card.height;
  if (above >= MARGIN) return { top: above, left };
  const inside = Math.min(target.top + target.height, viewport.height) - card.height - GAP * 2;
  return { top: Math.max(MARGIN, inside), left: clampLeft(target.left + GAP * 2) };
}
