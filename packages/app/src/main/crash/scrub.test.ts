import { describe, expect, it, vi } from 'vitest';

import {
  prepareEvent,
  REDACTED,
  redactSecrets,
  scrubBreadcrumb,
  scrubEvent,
  scrubText,
} from './scrub';

const home = '/home/fiddler';
// Built at runtime so no token-shaped literal is committed.
const token = `ghp_${'a1B2'.repeat(9)}`;
const pat = `github_pat_${'A'.repeat(22)}_${'b'.repeat(59)}`;
const npmToken = `npm_${'x'.repeat(36)}`;
const gistId = '0123456789abcdef0123456789abcdef';

describe('redactSecrets', () => {
  it('replaces the home directory with ~', () => {
    expect(redactSecrets(`open ${home}/fiddles/main.js`, home)).toBe(
      'open ~/fiddles/main.js',
    );
  });

  it('matches Windows homes in any case, with either slash, and JSON-escaped', () => {
    const win = 'C:\\Users\\Fiddler';
    expect(redactSecrets('c:\\users\\fiddler\\a.js', win)).toBe('~\\a.js');
    expect(redactSecrets('C:/Users/Fiddler/a.js', win)).toBe('~/a.js');
    expect(redactSecrets(JSON.stringify('C:\\Users\\Fiddler\\a.js'), win)).toBe(
      '"~\\\\a.js"',
    );
  });

  it('redacts GitHub and npm tokens, auth headers, secret pairs and URL passwords', () => {
    const text = [
      token,
      pat,
      npmToken,
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
      'GITHUB_TOKEN=hunter2hunter2',
      '"password": "hunter3"',
      'https://user:hunter4@example.com/x',
    ].join('\n');
    const out = redactSecrets(text, home);
    for (const secret of [
      token,
      pat,
      npmToken,
      'abcdefghijklmnop',
      'hunter2',
      'hunter3',
      'hunter4',
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('GITHUB_TOKEN=[redacted]');
    expect(out).toContain('https://[redacted]@example.com/x');
  });

  it('leaves ordinary text, authors and commit SHAs alone', () => {
    const sha = 'a'.repeat(40);
    const text = `author: Jane, commit ${sha}, token check failed`;
    expect(redactSecrets(text, home)).toBe(text);
  });

  it('takes linear time on long runs of word characters, hyphens and dots', () => {
    const started = performance.now();
    for (const unit of ['a-', 'a.', 'a-b.']) {
      const text = unit.repeat(40_000);
      expect(redactSecrets(text, home)).toBe(text);
      expect(scrubText(text, home)).toBe(text);
    }
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('still redacts a secret pair and URL password inside long text', () => {
    const padding = 'a-'.repeat(1000);
    expect(
      redactSecrets(`${padding} apiKey=hunter2 https://u:pw@example.com/`, home),
    ).toBe(`${padding} apiKey=${REDACTED} https://${REDACTED}@example.com/`);
  });
});

describe('scrubText', () => {
  it('strips URL query strings and gist IDs', () => {
    expect(
      scrubText(`https://gist.github.com/someone/${gistId}?token=abc#files`, home),
    ).toBe('https://gist.github.com/someone/<gist-id>#files');
    expect(scrubText('loading 0123456789abcdef0123 now', home)).toBe(
      'loading <gist-id> now',
    );
  });
});

describe('scrubEvent', () => {
  const event = {
    event_id: gistId,
    message: `failed to load ${home}/fiddles/${gistId}`,
    extra: { files: { 'main.js': 'const fiddleCode = 1' } },
    user: { ip_address: '192.0.2.1' },
    server_name: 'jane-laptop',
    contexts: {
      app: { app_name: 'Electron Fiddle' },
      env: { PATH: '/usr/bin', GITHUB_TOKEN: token },
      fiddle: { output: 'console output line' },
      trace: { trace_id: gistId },
    },
    request: {
      url: 'app://main/index.html?x=1',
      headers: { cookie: 'c=1' },
      data: 'request body',
    },
    exception: {
      values: [
        {
          type: 'Error',
          value: `bad token ${token}`,
          stacktrace: {
            frames: [
              { filename: `${home}/app/main.js`, vars: { text: 'const fiddleCode = 2' } },
            ],
          },
        },
      ],
    },
    breadcrumbs: [
      { category: 'console', message: 'console output line' },
      { category: 'fetch', data: { url: 'https://api.github.com/gists?secret=1' } },
      { category: 'ui.click', message: `clicked ${home}/x`, data: { apiKey: 'abc' } },
    ],
    tags: { 'event.process': 'browser' },
  };

  it('never attaches fiddle contents, console output, env or personal data', () => {
    const json = JSON.stringify(scrubEvent(event, home));
    for (const leaked of [
      'fiddleCode',
      'console output',
      'PATH',
      token,
      home,
      '192.0.2.1',
      'jane-laptop',
      'request body',
      'c=1',
      'secret=1',
    ]) {
      expect(json).not.toContain(leaked);
    }
  });

  it('keeps identifiers, allowed contexts and scrubbed messages', () => {
    const out = scrubEvent(event, home);
    expect(out.event_id).toBe(gistId);
    expect(out.contexts).toEqual({
      app: { app_name: 'Electron Fiddle' },
      trace: { trace_id: gistId },
    });
    expect(out.request).toEqual({ url: 'app://main/index.html' });
    expect(out.message).toBe('failed to load ~/fiddles/<gist-id>');
    expect(out.exception.values[0]?.stacktrace.frames[0]).toEqual({
      filename: '~/app/main.js',
    });
    expect(out.breadcrumbs).toEqual([
      { category: 'ui.click', message: 'clicked ~/x', data: { apiKey: '[redacted]' } },
    ]);
  });
});

describe('scrubBreadcrumb', () => {
  it('drops console and network breadcrumbs', () => {
    for (const category of ['console', 'fetch', 'xhr', 'electron.net']) {
      expect(scrubBreadcrumb({ category, message: 'x' }, home)).toBeNull();
    }
    expect(scrubBreadcrumb({ category: 'app', message: `${home}/a` }, home)).toEqual({
      category: 'app',
      message: '~/a',
    });
  });
});

describe('prepareEvent', () => {
  const native = (process: string) => ({
    tags: { 'event.environment': 'native', 'event.process': process },
    message: `${home}/dump`,
  });

  it('never sends native dumps from main or other processes, and does not ask', async () => {
    const ask = vi.fn(async () => true);
    expect(await prepareEvent(native('browser'), home, ask)).toBeNull();
    expect(await prepareEvent(native('GPU'), home, ask)).toBeNull();
    expect(await prepareEvent(native('unknown'), home, ask)).toBeNull();
    expect(ask).not.toHaveBeenCalled();
  });

  it('sends a renderer dump only with consent, crash by crash', async () => {
    const ask = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    expect(await prepareEvent(native('renderer'), home, ask)).toMatchObject({
      message: '~/dump',
    });
    expect(await prepareEvent(native('renderer'), home, ask)).toBeNull();
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('sends JavaScript errors without asking, scrubbed', async () => {
    const ask = vi.fn(async () => false);
    const out = await prepareEvent(
      { tags: { 'event.process': 'renderer' }, message: token },
      home,
      ask,
    );
    expect(out).toEqual({ tags: { 'event.process': 'renderer' }, message: '[redacted]' });
    expect(ask).not.toHaveBeenCalled();
  });
});
