import { describe, expect, it, vi } from 'vitest';

import type { VersionRef } from '../../fiddle/fiddle';
import type { ReleaseChannel } from '../../fiddle/versions';
import { ErrorCode } from '../../shared/errors';
import type { LocalBuild, ReleaseRow } from '../../shared/stores';
import { VersionSelector, type VersionSelectorDeps } from './select';

const dialog = { prompts: [] as string[], answer: true };
vi.mock('../dialogs', () => ({
  confirm: async (_windowId: string, { message }: { message: string }) => {
    dialog.prompts.push(message);
    return dialog.answer;
  },
}));
// Keys and values, so tests can see which message was built from what.
vi.mock('../i18n', () => ({
  tm: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}(${Object.values(values).join('|')})` : key,
}));
vi.mock('../log', () => ({ log: { warn: vi.fn() } }));

const row = (version: string, extra: Partial<ReleaseRow> = {}): ReleaseRow => ({
  version,
  date: '',
  node: '',
  obsolete: false,
  supported: true,
  ...extra,
});
const release = (version: string): VersionRef => ({ kind: 'release', version });
const sameRef = (a: VersionRef, b: VersionRef) => JSON.stringify(a) === JSON.stringify(b);

interface Options {
  version?: VersionRef;
  builds?: LocalBuild[];
  installed?: string[];
  channels?: ReleaseChannel[];
  answer?: boolean;
  install?: (version: string) => Promise<unknown>;
  /** Resolves when `setVersion` may apply `ref`. */
  setDelay?: (ref: VersionRef) => Promise<void>;
  busy?: boolean;
}

function setup(options: Options = {}) {
  const rows = [
    row('44.0.0-beta.3'),
    row('43.0.0'),
    row('42.4.1'),
    row('10.0.0', { supported: false }),
  ];
  const installed = new Set(options.installed ?? []);
  const settings = {
    channels: options.channels ?? ['stable', 'beta'],
    showObsolete: false,
    showNotDownloaded: true,
  };
  const state = {
    version: options.version ?? release('43.0.0'),
    notices: [] as string[],
    remembered: [] as VersionRef[],
    prompts: [] as string[],
    settings,
  };
  Object.assign(dialog, { prompts: state.prompts, answer: options.answer ?? true });
  const install = vi.fn(
    options.install ??
      (async (version: string) => {
        installed.add(version);
      }),
  );
  const deps: VersionSelectorDeps = {
    versions: {
      releases: () => rows,
      release: (version) => rows.find((r) => r.version === version),
      localBuilds: () => options.builds ?? [],
      localBuild: (id) => (options.builds ?? []).find((b) => b.id === id),
      isInstalled: (version) => installed.has(version),
      install,
    },
    settings: () => settings,
    showChannel: (channel) => {
      settings.channels = [...settings.channels, channel];
    },
    isBusy: () => options.busy ?? false,
    getVersion: () => state.version,
    setVersion: async (_windowId, ref) => {
      state.version = ref;
      if (options.setDelay) await options.setDelay(ref);
      return 7;
    },
    remember: (ref) => state.remembered.push(ref),
    notify: (_windowId, message) => state.notices.push(message),
    typesChanged: () => {},
  };
  return { selector: new VersionSelector(deps), state, install };
}

describe('VersionSelector.select', () => {
  it('sets, remembers and downloads the picked version', async () => {
    const { selector, state, install } = setup();
    await expect(
      selector.select('w', release('42.4.1'), { remember: true }),
    ).resolves.toBe(7);
    expect(state.version).toEqual(release('42.4.1'));
    expect(state.remembered).toEqual([release('42.4.1')]);
    expect(install).toHaveBeenCalledWith('42.4.1');
  });

  it("doesn't remember or download a pick that another one replaced while its template loaded", async () => {
    let land!: () => void;
    const slow = new Promise<void>((resolve) => (land = resolve));
    const { selector, state, install } = setup({
      setDelay: (ref) => (sameRef(ref, release('42.4.1')) ? slow : Promise.resolve()),
    });
    const first = selector.select('w', release('42.4.1'), { remember: true });
    await selector.select('w', release('44.0.0-beta.3'), { remember: true });
    land();
    await first;
    expect(state.version).toEqual(release('44.0.0-beta.3'));
    expect(state.remembered).toEqual([release('44.0.0-beta.3')]);
    expect(install.mock.calls).toEqual([['44.0.0-beta.3']]);
  });

  it("doesn't download a version that's already there", async () => {
    const { selector, install } = setup({ installed: ['42.4.1'] });
    await selector.select('w', release('42.4.1'));
    expect(install).not.toHaveBeenCalled();
  });

  it('refuses unknown and unrunnable versions, and busy windows', async () => {
    const { selector } = setup();
    await expect(selector.select('w', release('99.0.0'))).rejects.toMatchObject({
      code: ErrorCode.notFound,
    });
    await expect(selector.select('w', release('10.0.0'))).rejects.toMatchObject({
      code: ErrorCode.invalidArgument,
    });
    await expect(
      setup({ busy: true }).selector.select('w', release('42.4.1')),
    ).rejects.toMatchObject({
      code: ErrorCode.conflict,
    });
  });
});

describe('VersionSelector.validate', () => {
  it('leaves a usable version alone', async () => {
    const { selector, state } = setup();
    await selector.validate('w');
    expect(state.version).toEqual(release('43.0.0'));
    expect(state.notices).toEqual([]);
  });

  it('falls back from an unknown version to the first usable one and says so', async () => {
    const { selector, state, install } = setup({ version: release('99.0.0') });
    await selector.validate('w');
    expect(state.version).toEqual(release('44.0.0-beta.3'));
    expect(state.notices).toEqual([
      'fallback(versionUnknown(99.0.0)|electronVersion(44.0.0-beta.3))',
    ]);
    expect(install).toHaveBeenCalledWith('44.0.0-beta.3');
    expect(state.remembered).toEqual([]);
  });

  it('falls back from a local build whose binary is missing, preferring an available build', async () => {
    const builds: LocalBuild[] = [
      { id: 'gone', name: 'gone', path: '/gone', available: false },
      { id: 'ok', name: 'gn/main - testing', path: '/ok', available: true },
    ];
    const { selector, state } = setup({ version: { kind: 'local', id: 'gone' }, builds });
    await selector.validate('w');
    expect(state.version).toEqual({ kind: 'local', id: 'ok' });
    expect(state.notices).toEqual([
      'fallback(localBuildMissing(gone)|gn/main - testing)',
    ]);
  });

  it("doesn't touch a busy window", async () => {
    const { selector, state } = setup({ version: release('99.0.0'), busy: true });
    await selector.validate('w');
    expect(state.version).toEqual(release('99.0.0'));
  });
});

describe('failed downloads', () => {
  const failing = async (version: string) => {
    throw new Error(`offline ${version}`);
  };

  it('fall back to a downloaded version and show the error', async () => {
    const { selector, state } = setup({ installed: ['42.4.1'], install: failing });
    await selector.select('w', release('44.0.0-beta.3'));
    await vi.waitFor(() => expect(state.version).toEqual(release('42.4.1')));
    expect(state.notices).toEqual([
      'fallback(downloadFailed(44.0.0-beta.3|offline 44.0.0-beta.3)|electronVersion(42.4.1))',
    ]);
  });

  it('keep the version and show the error when nothing is downloaded', async () => {
    const { selector, state } = setup({ install: failing });
    await selector.select('w', release('42.4.1'));
    await vi.waitFor(() =>
      expect(state.notices).toEqual(['downloadFailed(42.4.1|offline 42.4.1)']),
    );
    expect(state.version).toEqual(release('42.4.1'));
  });

  it('are retried when the computer is back online', async () => {
    let online = false;
    const { selector, state, install } = setup({
      install: async (version) => {
        if (!online) throw new Error(`offline ${version}`);
      },
    });
    await selector.select('w', release('42.4.1'));
    await vi.waitFor(() => expect(state.notices).toHaveLength(1));
    online = true;
    selector.retry('w');
    expect(install).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(install.mock.results[1]?.type).toBe('return'));
    expect(state.notices).toHaveLength(1);
  });

  it('are not retried for a version that is already downloaded', () => {
    const { selector, install } = setup({ installed: ['43.0.0'] });
    selector.retry('w');
    expect(install).not.toHaveBeenCalled();
  });
});

describe('docs examples', () => {
  it('offer to show a hidden channel, then download the version', async () => {
    const { selector, state, install } = setup({
      version: release('44.0.0-beta.3'),
      channels: ['stable'],
    });
    await selector.docsExampleLoaded('w');
    expect(state.prompts).toEqual(['showBetaTitle']);
    expect(state.settings.channels).toEqual(['stable', 'beta']);
    expect(state.version).toEqual(release('44.0.0-beta.3'));
    expect(install).toHaveBeenCalledWith('44.0.0-beta.3');
    // A docs example isn't a pick: new windows keep the last-used version.
    expect(state.remembered).toEqual([]);
  });

  it('keep the version when the user declines', async () => {
    const { selector, state, install } = setup({
      version: release('44.0.0-beta.3'),
      channels: ['stable'],
      answer: false,
    });
    await selector.docsExampleLoaded('w');
    expect(state.settings.channels).toEqual(['stable']);
    expect(state.version).toEqual(release('44.0.0-beta.3'));
    expect(install).toHaveBeenCalledWith('44.0.0-beta.3');
  });

  it("don't ask when the channel is shown", async () => {
    const { selector, state } = setup({ version: release('44.0.0-beta.3') });
    await selector.docsExampleLoaded('w');
    expect(state.prompts).toEqual([]);
  });

  it('fall back when the version is unknown', async () => {
    const { selector, state } = setup({
      version: release('99.0.0-beta.1'),
      channels: ['stable'],
    });
    await selector.docsExampleLoaded('w');
    expect(state.prompts).toEqual([]);
    expect(state.version).toEqual(release('43.0.0'));
    expect(state.notices).toEqual([
      'fallback(versionUnknown(99.0.0-beta.1)|electronVersion(43.0.0))',
    ]);
  });
});
