import { describe, expect, it } from 'vitest';

import { FiddleError } from '../shared/errors';
import { bisectCompareUrl, Bisector, type BisectStep } from './bisect';

const versions = Array.from({ length: 10 }, (_, i) => `${i + 1}.0.0`);

function run(bisector: Bisector, firstBad: number): BisectStep {
  let step = bisector.current();
  let guard = 0;
  while (!step.done && guard++ < 50) {
    step = versions.indexOf(step.version) < firstBad ? bisector.good() : bisector.bad();
  }
  return step;
}

describe('Bisector', () => {
  it('starts at the midpoint', () => {
    expect(new Bisector(versions).current()).toEqual({ done: false, version: '5.0.0' });
  });

  it.each(Array.from({ length: 9 }, (_, i) => i + 1))('finds the first bad version at index %i', (firstBad) => {
    expect(run(new Bisector(versions), firstBad)).toEqual({
      done: true,
      good: versions[firstBad - 1],
      bad: versions[firstBad],
    });
  });

  it('is done at once with two versions', () => {
    expect(new Bisector(['1.0.0', '2.0.0']).current()).toEqual({ done: true, good: '1.0.0', bad: '2.0.0' });
  });

  it('needs at least two versions', () => {
    expect(() => new Bisector(['1.0.0'])).toThrow(FiddleError);
  });

  it('skips to a weighted-random version and never revisits it', () => {
    const bisector = new Bisector(versions, () => 0);
    expect(bisector.current()).toEqual({ done: false, version: '5.0.0' });
    expect(bisector.skip()).toEqual({ done: false, version: '2.0.0' });
    expect(bisector.good()).toEqual({ done: false, version: '6.0.0' });
    const high = new Bisector(versions, () => 0.9999);
    expect(high.skip()).toEqual({ done: false, version: '9.0.0' });
  });

  it('favours older versions when skipping', () => {
    const picks = [0.1, 0.5, 0.9].map((r) => {
      const bisector = new Bisector(versions, () => r);
      const step = bisector.skip();
      return step.done ? null : versions.indexOf(step.version);
    });
    // floor(r ** 1.5 * 7) over the candidates [1, 2, 3, 5, 6, 7, 8].
    expect(picks).toEqual([1, 3, 7]);
  });

  it('ends with the wider range when every candidate is skipped', () => {
    const bisector = new Bisector(['1.0.0', '2.0.0', '3.0.0']);
    expect(bisector.current()).toEqual({ done: false, version: '2.0.0' });
    expect(bisector.skip()).toEqual({ done: true, good: '1.0.0', bad: '3.0.0' });
  });

  it('stays done', () => {
    const bisector = new Bisector(['1.0.0', '2.0.0', '3.0.0']);
    const done = bisector.bad();
    expect(done).toEqual({ done: true, good: '1.0.0', bad: '2.0.0' });
    expect(bisector.good()).toEqual(done);
    expect(bisector.skip()).toEqual(done);
  });
});

describe('bisectCompareUrl', () => {
  it('links the electron compare view', () => {
    expect(bisectCompareUrl('30.0.0', '30.0.1')).toBe('https://github.com/electron/electron/compare/v30.0.0...v30.0.1');
  });
});
