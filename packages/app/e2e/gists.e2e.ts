// Gists against the fixture GitHub API: open by URL, sign in, publish,
// update, revision history, delete and sign out.
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appState,
  FIXTURE_GIST_ID,
  makeFolder,
  openedUrls,
  role,
  text,
  useApp,
  windowState,
} from './harness.ts';

const TOKEN = `ghp_${'a1B2'.repeat(9)}`;
// data/gists/<id>.json: the newest revision, an empty one (hidden) and the first.
const LATEST_REVISION = '3333333333333333333333333333333333333333';
const FIRST_REVISION = '1111111111111111111111111111111111111111';

describe('gists', () => {
  const app = useApp();
  const fiddle = async () => (await windowState(app())).fiddle;
  const requests = (method: string, prefix: string) =>
    app.fixtures().requests.filter((r) => r.method === method && r.path.startsWith(prefix));
  const openGist = async (value: string) => {
    await app().runCommand('gist.open');
    await app().query(role('dialog', 'Open a gist'));
    await app().type(value, role('textbox', 'Gist URL or ID'));
  };
  const gistMenu = async (item: string) => {
    await app().click(role('button', 'Publish'));
    await app().click(role('menuitem', item));
  };

  it('refuses text that is not a gist, and opens a gist by URL while signed out @feature load.gist-id-parse load.gist-public files.project-name', async () => {
    await openGist('not a gist');
    await app().press('Tab');
    await app().query(text('Enter a gist URL or a 32-character gist ID.'));
    await app().press('CmdOrCtrl+A', role('textbox', 'Gist URL or ID'));
    await app().type(`https://gist.github.com/fiddle-e2e/${FIXTURE_GIST_ID}#file-main-js`);
    await app().click(role('button', 'Open'));
    await app().waitForAbsent(role('dialog', 'Open a gist'));

    await expect.poll(async () => (await fiddle()).source.gistId).toBe(FIXTURE_GIST_ID);
    const loaded = await fiddle();
    expect(loaded.source).toMatchObject({ gistOwner: 'fiddle-e2e', gistRevision: LATEST_REVISION });
    // A gist has no folder, so the project gets a random three-word name.
    expect(loaded.name).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    await app().query(role('tab', 'renderer.js'));
    expect((await appState(app())).githubLogin).toBeUndefined();
  });

  it('shows the URL of the loaded gist @feature load.gist-url-shown', async () => {
    await app().runCommand('gist.open');
    await app().query(text(new RegExp(`^Loaded now: https://gist\\.github\\.com/.*${FIXTURE_GIST_ID}$`)));
    await app().click(role('button', 'Cancel'));
    await app().waitForAbsent(role('dialog', 'Open a gist'));
  });

  it('unlinks the gist when the fiddle is saved to a new folder @feature save.unlink-gist', async () => {
    const dir = path.join(makeFolder(app(), 'gist-parent'), 'from-gist');
    await app().queueDialog('open', { filePaths: [dir] });
    await app().runCommand('file.saveAs');
    await expect.poll(async () => (await fiddle()).source.localPath).toBe(dir);
    expect((await fiddle()).source.gistId).toBeUndefined();
  });

  it('asks for a token before publishing, and checks it @feature gist.sign-in-prompt gist.sign-in-token gist.sign-in-link gist.token-login-only', async () => {
    await app().click(role('button', 'Publish'));
    await app().query(role('dialog', 'Sign in to GitHub'));
    await app().type('not-a-token', role('textbox', 'Personal access token'));
    await app().click(role('button', 'Sign in'));
    await app().query(text("That doesn't look like a GitHub token. Tokens start with ghp_ or github_pat_."));

    // Links ask before opening in the browser.
    await app().queueDialog('messageBox', { button: 'Open link' });
    await app().click(role('button', 'Create a token on GitHub'));
    await expect
      .poll(() => openedUrls(app()))
      .toContainEqual(expect.stringMatching(/^https:\/\/github\.com\/settings\/tokens\/new\?.*scopes=gist/));

    await app().press('CmdOrCtrl+A', role('textbox', 'Personal access token'));
    await app().type(TOKEN);
    await app().click(role('button', 'Sign in'));
    await app().query(text('Signed in to GitHub as fiddle-e2e'));
    await expect.poll(async () => (await appState(app())).githubLogin).toBe('fiddle-e2e');
    // Renderers only ever see the login.
    expect(JSON.stringify(await app().stores(0))).not.toContain(TOKEN);
  });

  it('publishes with a description and visibility, then offers the link @feature gist.publish-description gist.publish-visibility gist.publish-revision gist.result-copy-link save.unlink-folder', async () => {
    if (!(await app().snapshot(0)).includes('dialog "Publish to GitHub"')) {
      await app().click(role('button', 'Publish'));
    }
    await app().query(role('dialog', 'Publish to GitHub'));
    expect(
      await app().evaluate(
        `[...document.querySelectorAll('input')].find((input) => input.labels?.[0]?.textContent?.includes('Description'))?.value`,
        0,
      ),
    ).toBe('Electron Fiddle Gist');

    await app().press('CmdOrCtrl+A', role('textbox', 'Description'));
    await app().press('Backspace');
    await app().query(text('Enter 1 to 256 characters.'));
    await app().type('My e2e gist', role('textbox', 'Description'));
    // The radio input sits under its label, so click the label's text.
    await app().click(text(/^Public$/));
    await app().click(role('button', 'Publish'));
    await app().query(text('Published to GitHub'));

    const [create] = requests('POST', '/github-api/gists');
    expect(JSON.parse(create?.body ?? '{}')).toMatchObject({ description: 'My e2e gist', public: true });
    // As a revision: created from the template, then updated with the fiddle's files.
    await expect.poll(() => requests('PATCH', '/github-api/gists/').length).toBe(1);

    const published = await fiddle();
    expect(published.source.gistId).toMatch(/^[0-9a-f]{32}$/);
    expect(published.source.localPath).toBeUndefined();
    expect((await appState(app())).settings.gistVisibility).toBe('public');

    await app().click(role('button', 'Copy link'));
    await expect.poll(() => app().clipboard()).toContain(published.source.gistId ?? '?');
  });

  it('updates the gist with the changed files @feature gist.update', async () => {
    const { gistId } = (await fiddle()).source;
    await app().click(role('tab', 'renderer.js'));
    await app().click(role('code'));
    await app().type('// updated');
    await expect.poll(async () => (await fiddle()).dirty).toBe(true);

    await gistMenu('Update gist');
    await app().query(text('Gist updated'));
    const update = requests('PATCH', `/github-api/gists/${gistId}`).at(-1);
    const sent = JSON.parse(update?.body ?? '{}') as { files?: Record<string, { content?: string } | null> };
    expect(sent.files?.['renderer.js']?.content).toContain('// updated');
    await expect.poll(async () => (await fiddle()).dirty).toBe(false);
  });

  it('lists the revisions of a gist and loads one @feature gist.history gist.history-hide-empty gist.history-load load.gist-revision', async () => {
    await openGist(FIXTURE_GIST_ID);
    await app().click(role('button', 'Open'));
    await expect.poll(async () => (await fiddle()).source.gistId).toBe(FIXTURE_GIST_ID);

    await app().runCommand('gist.history');
    await app().query(role('dialog', 'Gist history'));
    await app().query(text('Created'));
    await app().query(text('Active'));
    // Three revisions, but the middle one changed nothing, so it isn't listed.
    const snapshot = await app().snapshot(0);
    expect(snapshot.match(/StaticText "Revision \d+"/g)).toHaveLength(1);

    await app().click(text('Created'));
    await expect.poll(async () => (await fiddle()).source.gistRevision).toBe(FIRST_REVISION);
    expect(app.fixtures().requests.map((r) => r.path)).toContain(`/github-api/gists/${FIXTURE_GIST_ID}/${FIRST_REVISION}`);
  });

  it('deletes the gist and marks the fiddle unsaved @feature gist.delete save.gist-delete-dirty', async () => {
    if ((await app().snapshot(0)).includes('dialog "Gist history"')) await app().press('Escape');
    await app().waitForAbsent(role('dialog', 'Gist history'));
    await gistMenu('Delete gist');
    await app().query(role('alertdialog', 'Delete this gist?'));
    await app().click(role('button', 'Delete'));
    await app().query(text('Gist deleted'));
    expect(requests('DELETE', `/github-api/gists/${FIXTURE_GIST_ID}`)).toHaveLength(1);
    await expect.poll(async () => (await fiddle()).dirty).toBe(true);
  });

  it('signs out from the settings @feature gist.sign-out settings.github-account', async () => {
    await app().press('CmdOrCtrl+,');
    await app().click(role('button', 'GitHub'));
    await app().query(text('Signed in as fiddle-e2e'));
    await app().click(role('button', 'Sign out'));
    await app().query(text('Not signed in'));
    await expect.poll(async () => (await appState(app())).githubLogin).toBeUndefined();
    expect(fs.existsSync(path.join(app().testDir ?? '', 'userData', '.github-credentials'))).toBe(false);
    // The fiddle is unsaved: the harness quits after the last test.
    await app().queueDialog('messageBox', { button: 'Quit' });
  });
});
