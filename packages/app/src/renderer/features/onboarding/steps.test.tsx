import { describe, expect, it } from 'vitest';

import { BASICS_STEPS, MAIN_STEPS, placeCard } from './steps';

const viewport = { width: 1000, height: 800 };
const card = { width: 280, height: 150 };

describe('placeCard', () => {
  it('centres the card without a target', () => {
    expect(placeCard(null, card, viewport)).toEqual({ top: 325, left: 360 });
  });

  it('puts the card below a small target', () => {
    expect(placeCard({ top: 10, left: 400, width: 100, height: 36 }, card, viewport)).toEqual({
      top: 58,
      left: 400,
    });
  });

  it('puts the card above a target near the bottom', () => {
    expect(placeCard({ top: 700, left: 20, width: 200, height: 60 }, card, viewport)).toEqual({
      top: 538,
      left: 20,
    });
  });

  it('keeps the card inside the viewport', () => {
    expect(placeCard({ top: 10, left: 950, width: 40, height: 20 }, card, viewport).left).toBe(708);
  });

  it('overlaps a target that fills the window', () => {
    const placed = placeCard({ top: 50, left: 240, width: 760, height: 740 }, card, viewport);
    expect(placed.top).toBeGreaterThan(50);
    expect(placed.top + card.height).toBeLessThanOrEqual(viewport.height);
  });
});

describe('tour steps', () => {
  // @feature onboarding.tour
  it('covers the main areas and the basics files', () => {
    expect(new Set(MAIN_STEPS.map((step) => step.target))).toEqual(
      new Set(['editor', 'version-picker', 'run', 'publish', 'console', 'sidebar']),
    );
    expect(BASICS_STEPS.map((step) => step.file)).toEqual(['main.js', 'index.html', 'renderer.js']);
  });
});
