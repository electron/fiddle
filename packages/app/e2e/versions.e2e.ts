// The version picker, the version manager and a manual bisect over the
// fixture release list (44.3.0, 43.7.0, 42.11.3 and 45.0.0-alpha.6).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_DIR } from './driver.ts';
import {
  appState,
  dialogMessages,
  openedUrls,
  role,
  text,
  useApp,
  windowState,
} from './harness.ts';

describe('versions', () => {
  const app = useApp();
  const fiddle = async () => (await windowState(app())).fiddle;
  const picker = role('button', /^Electron \d+\.\d+\.\d+/);

  it('selects the latest stable version by default', async () => {
    expect((await fiddle()).versionRef).toEqual({ kind: 'release', version: '44.3.0' });
    await app().query(role('button', /^Electron 44\.3\.0\b/));
  });

  it('lists stable releases newest first, then pre-releases, and searches them', async () => {
    await app().click(picker);
    const names = (await app().query(role('option'))).map((option) => option.name);
    expect(names).toEqual([
      expect.stringMatching(/^Electron 44\.3\.0\b.*latest$/),
      expect.stringMatching(/^Electron 43\.7\.0\b/),
      expect.stringMatching(/^Electron 42\.11\.3\b/),
      expect.stringMatching(/^Electron 45\.0\.0-alpha\.6\b.*beta$/),
      'Copy version number',
    ]);
    // Each row shows its install state.
    expect(await app().query(role('StaticText', 'Not downloaded'))).toHaveLength(4);

    await app().type('43', role('searchbox', 'Search versions'));
    await expect
      .poll(async () =>
        (await app().query(role('option')))
          .map((option) => option.name)
          .filter((n) => n.startsWith('Electron')),
      )
      .toEqual([expect.stringMatching(/^Electron 43\.7\.0\b/)]);
    // The first Escape clears the search, the second closes the menu.
    await app().press('Escape');
    await app().press('Escape');
    await app().waitForAbsent(role('dialog', 'Electron version'));
  });

  it('copies the version number from the picker', async () => {
    await app().click(picker);
    await app().click(role('option', 'Copy version number'));
    await expect.poll(() => app().clipboard()).toBe('44.3.0');
    await app().waitForAbsent(role('listbox', 'Electron version'));
  });

  it('downloads a version from the version manager', async () => {
    await app().press('CmdOrCtrl+,');
    await app().click(role('button', 'Electron'));
    await app().type('44', role('textbox', 'Filter versions'));
    await app().waitForAbsent(role('cell', '43.7.0'));
    await app().query(role('cell', 'Not downloaded'));

    await app().click(role('button', /^Download\b/, { nth: 0 }));
    // Download also unzips. Wait for that too: while it unzips the row has no Remove button,
    // and a click that lands as it starts is lost.
    await expect
      .poll(async () => (await appState(app())).versions?.installs['44.3.0']?.state, {
        timeout: 60_000,
      })
      .toBe('installed');
    await app().query(role('cell', 'Downloaded', { timeout: 30_000 }));
  }, 90_000);

  it("can't remove the active version", async () => {
    await app().click(role('button', /^Remove\b/, { nth: 0 }));
    await expect
      .poll(
        async () =>
          `${await app().snapshot(0)}\n${(await dialogMessages(app())).join('\n')}`,
      )
      .toContain("Electron 44.3.0 is in use, so it can't be removed.");
    expect((await appState(app())).versions?.installs['44.3.0']?.state).toBe('installed');
  });

  it('refreshes the release list on demand', async () => {
    const count = () =>
      app.fixtures().requests.filter((r) => r.path === '/releases.json').length;
    const before = count();
    await app().click(role('button', 'Refresh'));
    await expect.poll(count).toBeGreaterThan(before);
    await app().click(role('button', 'Close settings'));
    await app().waitForAbsent(role('navigation', 'Settings sections'));
  });

  it("switches versions, swapping an unedited template for the new version's", async () => {
    const { fiddleRev } = await fiddle();
    await app().click(picker);
    await app().click(role('option', /^Electron 43\.7\.0\b/));
    await expect
      .poll(async () => (await fiddle()).versionRef)
      .toEqual({ kind: 'release', version: '43.7.0' });
    await app().query(role('button', /^Electron 43\.7\.0\b/));
    await expect
      .poll(() => app.fixtures().requests.map((r) => r.path))
      .toContain('/minimal-repro/archive/43-x-y.zip');
    await expect.poll(async () => (await fiddle()).fiddleRev).toBeGreaterThan(fiddleRev);
  });

  it('refuses a bisect range whose good version is newer than the bad one', async () => {
    await app().press('CmdOrCtrl+Shift+B');
    await app().query(role('dialog', 'Bisect'));
    await app().click(role('button', /Good version$/));
    await app().click(role('option', /^45\.0\.0-alpha\.6\b/));
    await app().query(text('The good version must be older than the bad one.'));
    expect((await app().query(role('button', 'Start')))[0]?.states).toContain('disabled');
    await app().click(role('button', 'Cancel'));
    await app().waitForAbsent(role('dialog', 'Bisect'));
  });

  it('bisects by hand and shows the range with its GitHub comparison', async () => {
    await app().press('CmdOrCtrl+Shift+B');
    await app().click(role('button', 'Start'));
    const bisect = async () => (await windowState(app())).run?.bisect ?? null;
    await expect.poll(async () => (await bisect())?.current ?? null).not.toBeNull();

    // Marking every version bad narrows the range down to its good end.
    for (let step = 0; step < 5; step++) {
      const state = await bisect();
      if (!state?.current || state.result) break;
      await app().query(text(`Bisecting ${state.current}`));
      expect((await fiddle()).versionRef).toEqual({
        kind: 'release',
        version: state.current,
      });
      expect((await app().query(picker))[0]?.states).toContain('disabled');
      await app().click(role('button', 'Bad'));
      await expect
        .poll(async () => {
          const next = await bisect();
          return next?.result !== null || next?.current !== state.current;
        })
        .toBe(true);
    }

    await app().query(role('dialog', 'Bisect finished'));
    const finished = await bisect();
    const result = finished?.result;
    expect(result?.good).toBe(finished?.good);
    const compare = `https://github.com/electron/electron/compare/v${result?.good}...v${result?.bad}`;
    await app().query(
      text(`The change happened between Electron ${result?.good} and ${result?.bad}.`),
    );
    await app().query(text(compare));

    await app().queueDialog('messageBox', { button: 'Open' });
    await app().click(role('button', 'Compare on GitHub'));
    await expect.poll(() => openedUrls(app())).toContain(compare);
    await app().click(role('button', 'Close'));
    await app().waitForAbsent(role('dialog', 'Bisect finished'));
  });

  it('deletes every download except the active version', async () => {
    const installed = async () =>
      Object.entries((await appState(app())).versions?.installs ?? {})
        .filter(
          ([, install]) =>
            install.state === 'installed' || install.state === 'downloaded',
        )
        .map(([version]) => version);
    const active = (await fiddle()).versionRef;
    const others = async () =>
      (await installed()).filter(
        (version) => active.kind !== 'release' || version !== active.version,
      );
    // 44.3.0 was downloaded above; the bisect left another version active.
    expect(await others()).toContain('44.3.0');

    await app().click(role('button', 'Settings'));
    await app().click(role('button', 'Electron'));
    await app().click(role('button', 'Delete all'));
    await app().query(role('alertdialog', 'Delete all downloaded versions?'));
    await app().click(role('button', 'Delete all'));
    await expect.poll(others).toEqual([]);
    expect((await fiddle()).versionRef).toEqual(active);
  });

  it('adds a local build, and offers to switch to it when it is added again', async () => {
    // The build folder is electron's dist/; on macOS the executable is three levels down, in Electron.app/Contents/MacOS.
    const exec = createRequire(path.join(APP_DIR, 'package.json'))('electron') as string;
    const dist =
      process.platform === 'darwin'
        ? path.resolve(path.dirname(exec), '..', '..', '..')
        : path.dirname(exec);
    const builds = async () => (await appState(app())).versions?.localBuilds ?? [];
    await app().queueDialog('open', { filePaths: [dist] });
    await app().click(role('button', 'Add local build'));
    await expect.poll(async () => (await builds()).length).toBe(1);
    const [build] = await builds();
    expect(build).toMatchObject({ path: dist, available: true });
    // The store writes the file asynchronously, so wait for it.
    const stored = path.join(app().testDir ?? '', 'userData', 'local-builds.json');
    await expect
      .poll(() => (fs.existsSync(stored) ? fs.readFileSync(stored, 'utf8') : ''))
      .toContain(build?.id ?? '?');

    // The same folder again: offer to switch to the registered build.
    await app().queueDialog('open', { filePaths: [dist] });
    await app().queueDialog('messageBox', { response: 0 });
    await app().click(role('button', 'Add local build'));
    await expect
      .poll(async () => (await fiddle()).versionRef)
      .toEqual({ kind: 'local', id: build?.id });
    expect(await builds()).toHaveLength(1);
  });
});
