import {
  VersionSource,
  VersionState,
  RunnableVersion,
} from '../../src/interfaces';
import { sortVersions } from '../../src/utils/sort-versions';

describe('sort-versions', () => {
  function makeVersion(version: string): RunnableVersion {
    return {
      source: VersionSource.remote,
      state: VersionState.unknown,
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

    expect(sorted).toStrictEqual<any>([
      makeVersion('v3.0.0'),
      makeVersion('v2.0.0'),
      makeVersion('v1.0.0'),
    ]);
  });

  it('sorts nightly and beta versions correctly', () => {
    const unsorted: RunnableVersion[] = [
      makeVersion('v2.0.0-nightly.20200101'),
      makeVersion('v2.0.0-beta.1'),
      makeVersion('v2.0.0-nightly.20200102'),
      makeVersion('v3.0.0-beta.1'),
      makeVersion('v3.0.0-nightly.20200105'),
      makeVersion('v2.0.0-beta.2'),
      makeVersion('v2.0.0-beta.3'),
      makeVersion('v2.0.0'),
      makeVersion('v3.0.0'),
    ];

    const sorted = sortVersions([...unsorted]);

    expect(sorted).toStrictEqual<any>([
      makeVersion('v3.0.0'),
      makeVersion('v3.0.0-beta.1'),
      makeVersion('v3.0.0-nightly.20200105'),
      makeVersion('v2.0.0'),
      makeVersion('v2.0.0-beta.3'),
      makeVersion('v2.0.0-beta.2'),
      makeVersion('v2.0.0-beta.1'),
      makeVersion('v2.0.0-nightly.20200102'),
      makeVersion('v2.0.0-nightly.20200101'),
    ]);
  });

  it('handles invalid versions', () => {
    const unsorted: RunnableVersion[] = [
      makeVersion('moreGarbage'),
      makeVersion('v1.0.0'),
      makeVersion('v3.0.0'),
      makeVersion('garbage'),
    ];

    const sorted = sortVersions([...unsorted]);

    expect(sorted).toStrictEqual<any>([
      makeVersion('garbage'),
      makeVersion('moreGarbage'),
      makeVersion('v3.0.0'),
      makeVersion('v1.0.0'),
    ]);
  });
});
