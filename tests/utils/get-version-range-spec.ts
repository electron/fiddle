import * as semver from 'semver';

import { VersionsMock } from '../mocks/electron-versions';

import { getVersionRange } from '../../src/utils/get-version-range';

describe('getVersionRange', () => {
  const { mockVersionsArray } = new VersionsMock();
  const knownVersions = [...mockVersionsArray].reverse();
  const midpoint = Math.floor(knownVersions.length / 2);

  it('returns an empty array if the lower bound cannot be found', () => {
    const lowerBound = '1.0.0';
    const upperBound = knownVersions[midpoint].version;
    // test setup: confirm that one bound is present and the other is not
    expect(knownVersions.map((v) => v.version)).not.toContain(lowerBound);
    expect(knownVersions.map((v) => v.version)).toContain(upperBound);

    const versions = getVersionRange(lowerBound, upperBound, knownVersions);

    expect(versions).toEqual([]);
  });

  it('returns an empty array if the upper bound cannot be found', () => {
    const lowerBound = knownVersions[midpoint].version;
    const upperBound = '10000.0.0';
    // test setup: confirm that one bound is present and the other is not
    expect(knownVersions.map((v) => v.version)).toContain(lowerBound);
    expect(knownVersions.map((v) => v.version)).not.toContain(upperBound);

    const versions = getVersionRange(lowerBound, upperBound, knownVersions);

    expect(versions).toEqual([]);
  });

  it('returns a subset clipped to the bounds', () => {
    const oldestToNewest = knownVersions;
    const subset = oldestToNewest.slice(1, -1);
    const lowerBound = subset[0].version;
    const upperBound = subset[subset.length - 1].version;

    const versions = getVersionRange(lowerBound, upperBound, oldestToNewest);

    expect(versions).toEqual(subset);
  });

  it('handles lower bound > upper bound', () => {
    const oldestToNewest = knownVersions;
    const lowerBound = knownVersions[knownVersions.length - 1].version;
    const upperBound = knownVersions[0].version;
    expect(semver.compare(lowerBound, upperBound)).toBeGreaterThan(0);

    const versions = getVersionRange(lowerBound, upperBound, knownVersions);

    expect(versions).toEqual(oldestToNewest);
  });

  it('ensures the result is sorted from oldest to newest', () => {
    const oldestToNewest = knownVersions;
    const newestToOldest = [...oldestToNewest].reverse();
    const lowerBound = newestToOldest[newestToOldest.length - 1].version;
    const upperBound = newestToOldest[0].version;
    expect(semver.compare(lowerBound, upperBound)).toBeLessThan(0);

    let versions = getVersionRange(lowerBound, upperBound, oldestToNewest);
    expect(versions).toEqual(oldestToNewest);

    versions = getVersionRange(lowerBound, upperBound, newestToOldest);
    expect(versions).toEqual(oldestToNewest);
  });
});
