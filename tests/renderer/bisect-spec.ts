import { ElectronVersionSource, ElectronVersionState } from '../../src/interfaces';
import { Bisector } from '../../src/renderer/bisect';

const generateVersionRange = (rangeLength: number) =>
  (new Array(rangeLength)).fill(0).map((_, i) => ({
    state: ElectronVersionState.ready,
    version: `${i + 1}.0.0`,
    source: ElectronVersionSource.local
  }));

describe('bisect', () => {
  let bisector: Bisector;

  beforeEach(() => {
    const versions = generateVersionRange(9);
    bisector = new Bisector(versions);
  });

  it('selects a pivot in the middle of the array', () => {
    const pivot = bisector.getCurrentVersion();
    const middleIndex = Math.floor(bisector.revList.length / 2);
    expect(pivot).toBe(bisector.revList[middleIndex]);
  });

  describe('continue()', () => {
    it('returns the current version', () => {
      const result = bisector.continue(true);
      const version = bisector.getCurrentVersion();
      expect(result).toBe(version);
    });

    it('discards lower half of the range if pivot is good version', () => {
      const pivotVersion = bisector.getCurrentVersion();
      bisector.continue(true);
      expect(bisector.revList[bisector.minRev]).toBe(pivotVersion);
    });

    it('discards upper half of the range if pivot is bad version', () => {
      const pivotVersion = bisector.getCurrentVersion();
      bisector.continue(false);
      expect(bisector.revList[bisector.maxRev]).toBe(pivotVersion);
    });

    it('terminates if fewer than 2 items are left', () => {
      const versions = generateVersionRange(2);
      bisector = new Bisector(versions);

      expect(bisector.revList.length).toBe(2);
      const responseGood = bisector.continue(true);
      expect(responseGood).toHaveLength(2);
      expect(versions).toContain(responseGood[0]);
      expect(versions).toContain(responseGood[1]);

      bisector = new Bisector(versions);

      expect(bisector.revList.length).toBe(2);
      const responseBad = bisector.continue(false);
      expect(responseBad).toHaveLength(2);
      expect(versions).toContain(responseBad[0]);
      expect(versions).toContain(responseBad[1]);
    });
  });

  describe('getCurrentVersion()', () => {
    it('returns a version within the range', () => {
      const version = bisector.getCurrentVersion();
      expect(bisector.revList).toContain(version);
    });
  });
});
