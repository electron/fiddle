import { describe, expect, it } from 'vitest';

import {
  InstallState,
  RunnableVersion,
  VersionSource,
} from '../../../src/interfaces';
import { sortVersions } from '../../../src/renderer/utils/sort-versions';

describe('sort-versions', () => {
  function makeVersion(version: string): RunnableVersion {
    return {
      source: VersionSource.remote,
      state: InstallState.missing,
      version,
    };
  }

  it('sorts electron versions', () => {
    const unsorted: RunnableVersion[] = [
      makeVersion('v1.0.0'),
      makeVersion('v3.0.0'),
      makeVersion('v2.0.0'),
    ];

    const sorted = sortVersions([...unsorted]);

    expect(sorted).toStrictEqual([
      makeVersion('v3.0.0'),
      makeVersion('v2.0.0'),
      makeVersion('v1.0.0'),
    ]);
  });

  it('sorts nightly, alpha, and beta versions correctly', () => {
    const unsorted: RunnableVersion[] = [
      makeVersion('v3.0.0-alpha.1'),
      makeVersion('v2.0.0-nightly.20200101'),
      makeVersion('v2.0.0-beta.1'),
      makeVersion('v2.0.0-alpha.1'),
      makeVersion('v2.0.0-nightly.20200102'),
      makeVersion('v3.0.0-beta.1'),
      makeVersion('v3.0.0-nightly.20200105'),
      makeVersion('v2.0.0-beta.2'),
      makeVersion('v2.0.0-beta.3'),
      makeVersion('v2.0.0'),
      makeVersion('v3.0.0'),
    ];

    const sorted = sortVersions([...unsorted]);

    expect(sorted).toStrictEqual([
      makeVersion('v3.0.0'),
      makeVersion('v3.0.0-beta.1'),
      makeVersion('v3.0.0-alpha.1'),
      makeVersion('v3.0.0-nightly.20200105'),
      makeVersion('v2.0.0'),
      makeVersion('v2.0.0-beta.3'),
      makeVersion('v2.0.0-beta.2'),
      makeVersion('v2.0.0-beta.1'),
      makeVersion('v2.0.0-alpha.1'),
      makeVersion('v2.0.0-nightly.20200102'),
      makeVersion('v2.0.0-nightly.20200101'),
    ]);
  });

  it('handles non-semver local version keys gracefully', () => {
    const localVersion: RunnableVersion = {
      source: VersionSource.local,
      state: InstallState.installed,
      version: '0.0.0-local.1234567890',
      name: 'My Build',
    };

    const unsorted: RunnableVersion[] = [
      makeVersion('v1.0.0'),
      localVersion,
      makeVersion('v3.0.0'),
      makeVersion('v2.0.0'),
    ];

    const sorted = sortVersions([...unsorted]);

    // Local version key (0.0.0-local.xxx) sorts after real semver
    expect(sorted[0]).toStrictEqual(makeVersion('v3.0.0'));
    expect(sorted[1]).toStrictEqual(makeVersion('v2.0.0'));
    expect(sorted[2]).toStrictEqual(makeVersion('v1.0.0'));
    expect(sorted[3]).toStrictEqual(localVersion);
  });
});
