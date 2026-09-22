import { describe, expect, it, vi } from 'vitest';

import type { VersionRef } from '../../fiddle/fiddle';
import type { ReleaseChannel } from '../../fiddle/versions';
import { ErrorCode } from '../../shared/errors';
import type { LocalBuild, ReleaseRow, VersionNotice } from '../../shared/stores';
import type { ChangeListener } from '../state-hub';
import { VersionSelector } from './select';

const dialog = { prompts: [] as string[], answer: true };
vi.mock('../dialogs', () => ({
  confirm: async (_windowId: string, { message }: { message: string }) => {
    dialog.prompts.push(message);
    return dialog.answer;
  },
}));
const docs = vi.hoisted(() => ({ setFiddleVersion: vi.fn(), getStateStore: vi.fn() }));
vi.mock('../documents/service', () => docs);
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
  install?: (version: string) => Promise<string>;
  /** Resolves when `setFiddleVersion` may apply `ref`. */
  setDelay?: (ref: VersionRef) => Promise<void>;
  busy?: boolean;
  /** The ID of the build the folder picker adds. */
  added?: string;
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
    /** Window `w`'s version; undefined once it has closed. */
    version: (options.version ?? release('43.0.0')) as VersionRef | undefined,
    notice: null as VersionNotice | null,
    notices: [] as string[],
    remembered: [] as VersionRef[],
    prompts: [] as string[],
    settings,
  };
  Object.assign(dialog, { prompts: state.prompts, answer: options.answer ?? true });
  docs.setFiddleVersion.mockImplementation(async (_windowId: string, ref: VersionRef) => {
    state.version = ref;
    if (options.setDelay) await options.setDelay(ref);
    return 7;
  });
  docs.getStateStore.mockReturnValue({
    set: (update: (prev: object) => { lastVersion: VersionRef }) =>
      state.remembered.push(update({}).lastVersion),
  });
  const listeners = new Set<ChangeListener>();
  const hub = {
    app: { settings },
    getWindow: (id: string) =>
      id === 'w' && state.version
        ? { rev: 7, versionNotice: state.notice, fiddle: { versionRef: state.version } }
        : undefined,
    updateWindow: (_id: string, patch: { versionNotice: VersionNotice | null }) => {
      state.notice = patch.versionNotice;
      if (patch.versionNotice) state.notices.push(patch.versionNotice.message);
      return 8;
    },
    onChange: (listener: ChangeListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const install = vi.fn(
    options.install ??
      (async (version: string) => {
        installed.add(version);
        return '/electron';
      }),
  );
  const selector = new VersionSelector({
    hub: hub as never,
    versions: {
      releases: () => rows,
      release: (version) => rows.find((r) => r.version === version),
      localBuilds: () => options.builds ?? [],
      localBuild: (id) => (options.builds ?? []).find((b) => b.id === id),
      isInstalled: (version) => installed.has(version),
      install,
      addLocalBuild: async () => options.added,
    },
    settings: { set: (_key, channels) => (settings.channels = channels) },
    isBusy: () => options.busy ?? false,
    typesChanged: () => {},
  });
  const emit: ChangeListener = (change) => listeners.forEach((l) => l(change));
  return { selector, state, install, emit, listeners };
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

  it("returns the window's rev when nothing changed", async () => {
    const { selector } = setup({ installed: ['43.0.0'] });
    await expect(selector.select('w', release('43.0.0'))).resolves.toBe(7);
    expect(docs.setFiddleVersion).not.toHaveBeenCalled();
  });

  it('selects and remembers the local build the user adds, and reports whether one was added', async () => {
    const builds = [{ id: 'b1', name: 'testing', path: '/b1', available: true }];
    const { selector, state } = setup({ builds, added: 'b1' });
    expect(await selector.addLocalBuild('w')).toBe(true);
    expect(state.version).toEqual({ kind: 'local', id: 'b1' });
    expect(state.remembered).toEqual([{ kind: 'local', id: 'b1' }]);
    expect(await setup().selector.addLocalBuild('w')).toBe(false);
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
      'fallback(offline 44.0.0-beta.3|electronVersion(42.4.1))',
    ]);
  });

  it('keep the version and show the error when nothing is downloaded', async () => {
    const { selector, state } = setup({ install: failing });
    await selector.select('w', release('42.4.1'));
    await vi.waitFor(() => expect(state.notices).toEqual(['offline 42.4.1']));
    expect(state.version).toEqual(release('42.4.1'));
  });

  it('are retried when the computer is back online', async () => {
    let online = false;
    const { selector, state, install } = setup({
      install: async (version) => {
        if (!online) throw new Error(`offline ${version}`);
        return '/electron';
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

describe('VersionSelector.watch', () => {
  it("validates the window's version once per distinct version, ignoring other stores and windows", async () => {
    const { selector, state, emit } = setup({ version: release('99.0.0') });
    selector.watch('w');
    emit({ store: 'app' });
    emit({ store: 'window', windowId: 'other' });
    expect(docs.setFiddleVersion).not.toHaveBeenCalled();

    emit({ store: 'window', windowId: 'w' });
    emit({ store: 'window', windowId: 'w' });
    await vi.waitFor(() => expect(state.notices).toHaveLength(1));
    expect(state.version).toEqual(release('44.0.0-beta.3'));
    expect(docs.setFiddleVersion).toHaveBeenCalledOnce();

    state.version = { kind: 'local', id: 'gone' };
    emit({ store: 'window', windowId: 'w' });
    await vi.waitFor(() => expect(state.notices).toHaveLength(2));
  });

  it('skips a window the hub no longer has, and stops with its unsubscribe', () => {
    const { selector, state, emit, listeners } = setup({ version: release('99.0.0') });
    const stop = selector.watch('w');
    const gone = state.version;
    state.version = undefined;
    emit({ store: 'window', windowId: 'w' });
    state.version = gone;
    stop();
    emit({ store: 'window', windowId: 'w' });
    expect(listeners.size).toBe(0);
    expect(docs.setFiddleVersion).not.toHaveBeenCalled();
  });

  it('logs a failed check instead of leaving the rejection unhandled', async () => {
    const { log } = await import('../log');
    const { selector, emit } = setup({ version: release('99.0.0') });
    docs.setFiddleVersion.mockRejectedValueOnce(new Error('template'));
    selector.watch('w');
    emit({ store: 'window', windowId: 'w' });
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalled());
  });
});

it('dismisses the notice the renderer names, and leaves a newer one alone', async () => {
  const { selector, state } = setup({ version: release('99.0.0'), installed: [] });
  await selector.validate('w');
  expect(state.notice?.id).toBe(1);
  selector.dismissNotice('w', 2);
  expect(state.notice?.id).toBe(1);
  selector.dismissNotice('w', 1);
  expect(state.notice).toBeNull();
});
