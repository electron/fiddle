import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import { findDeepLinkInArgv, parseDeepLink } from '../../fiddle/deep-link';
import { ErrorCode, FiddleError } from '../../shared/errors';
import {
  DeepLinkQueue,
  DIALOG_TEXT_MAX,
  dialogText,
  gistLinkDetail,
  gistUrlToDeepLink,
  shouldOfferSignIn,
} from './deep-link-queue';

describe('gistUrlToDeepLink', () => {
  const id = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
  const sha = 'a'.repeat(40);

  it('turns a gist page URL (dropped on the dock) into the matching gist link', () => {
    expect(gistUrlToDeepLink(`https://gist.github.com/${id}`)).toBe(`electron-fiddle://gist/${id}`);
    expect(gistUrlToDeepLink(`https://GIST.github.com/octocat/${id}/`)).toBe(`electron-fiddle://gist/octocat/${id}`);
    const withRevision = gistUrlToDeepLink(`https://gist.github.com/octocat/${id}/${sha}`);
    expect(withRevision).toBe(`electron-fiddle://gist/octocat/${id}?revision=${sha}`);
    expect(parseDeepLink(withRevision!)).toMatchObject({ ok: true, link: { kind: 'gist', id, owner: 'octocat', revision: sha } });
  });

  it('accepts nothing else', () => {
    for (const text of [
      `http://gist.github.com/${id}`,
      `https://gist.github.com.evil.test/${id}`,
      `https://github.com/octocat/${id}`,
      `https://gist.github.com/octocat/${id}/raw/main.js`,
      `https://user@gist.github.com/${id}`,
      `https://gist.github.com:8443/${id}`,
      `electron-fiddle://gist/${id}`,
      'not a url',
    ]) {
      expect(gistUrlToDeepLink(text), text).toBeUndefined();
    }
  });
});

describe('DeepLinkQueue', () => {
  it('queues links until the app is ready, then handles them in order', async () => {
    const handled: string[] = [];
    const queue = new DeepLinkQueue(async (url) => {
      handled.push(url);
    });
    queue.push('electron-fiddle://gist/1');
    queue.push('electron-fiddle://gist/2');
    expect(handled).toEqual([]);
    await queue.start();
    expect(handled).toEqual(['electron-fiddle://gist/1', 'electron-fiddle://gist/2']);
  });

  it('keeps one prompt pending at a time, and handles a link that arrives meanwhile next', async () => {
    const releases: Array<() => void> = [];
    const handle = vi.fn(() => new Promise<void>((resolve) => releases.push(resolve)));
    const onBusy = vi.fn();
    const queue = new DeepLinkQueue(handle, onBusy);
    await queue.start();

    queue.push('electron-fiddle://gist/a');
    expect(queue.busy).toBe(true);
    queue.push('electron-fiddle://gist/b');
    expect(handle).toHaveBeenCalledTimes(1);
    expect(onBusy).toHaveBeenCalledWith('electron-fiddle://gist/b');
    expect(queue.waiting).toBe(1);

    releases[0]!();
    await vi.waitFor(() => expect(handle).toHaveBeenCalledTimes(2));
    expect(handle).toHaveBeenLastCalledWith('electron-fiddle://gist/b');
    releases[1]!();
    await vi.waitFor(() => expect(queue.busy).toBe(false));
    queue.push('electron-fiddle://gist/c');
    expect(handle).toHaveBeenCalledTimes(3);
  });

  it('keeps going after a handler fails', async () => {
    const handle = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    const queue = new DeepLinkQueue(handle);
    queue.push('electron-fiddle://gist/a');
    queue.push('electron-fiddle://gist/b');
    await queue.start();
    expect(handle).toHaveBeenCalledTimes(2);
    expect(queue.busy).toBe(false);
  });

  it('finds links in argv on every platform', () => {
    expect(findDeepLinkInArgv(['/app', '--flag', 'ELECTRON-FIDDLE://gist/abc'])).toBe('ELECTRON-FIDDLE://gist/abc');
    expect(findDeepLinkInArgv(['/app', '.'])).toBeUndefined();
  });
});

describe('gistLinkDetail', () => {
  const t = ((key: string, options?: Record<string, string>) =>
    options ? `${key}:${Object.values(options).join('|')}` : key) as unknown as TFunction<'mainDocuments'>;
  const gist = {
    owner: 'octocat',
    description: 'demo',
    revision: 'b'.repeat(40),
    files: { 'main.js': '', 'package.json': '{}' },
  };

  // @feature load.deep-link-confirm
  it('shows the owner, revision, files, dependencies, and the description last', () => {
    const detail = gistLinkDetail({}, gist, { lodash: '^4.0.0' }, t);
    expect(detail.split('\n')).toEqual([
      'detailOwner:octocat',
      `detailRevision:${'b'.repeat(40)}`,
      'detailFiles:main.js, package.json',
      'detailDependencies:lodash@^4.0.0',
      'detailDescription:demo',
      '',
      'linkUntrusted',
    ]);
  });

  it('keeps every gist-controlled value on one short line, without bidi controls', () => {
    const spoof = {
      ...gist,
      owner: 'octo\u202ecat',
      description: `line one\nOwner: electron\r\n\u0007${'x'.repeat(500)}`,
      files: { 'main\u202esj.js': '', 'index\nhtml.html': '' },
    };
    const lines = gistLinkDetail({}, spoof, {}, t).split('\n');
    expect(lines).toHaveLength(7);
    expect(lines[0]).toBe('detailOwner:octocat');
    expect(lines[2]).toBe('detailFiles:mainsj.js, index html.html');
    const description = lines[4]!.slice('detailDescription:'.length);
    expect(description.startsWith('line one Owner: electron xxx')).toBe(true);
    expect(Array.from(description)).toHaveLength(DIALOG_TEXT_MAX);
    expect(description.endsWith('…')).toBe(true);
  });

  it('warns when the owner in the link does not match', () => {
    expect(gistLinkDetail({ owner: 'someone' }, gist, {}, t)).toContain('linkOwnerMismatch:someone|octocat');
    expect(gistLinkDetail({ owner: 'OctoCat' }, gist, {}, t)).not.toContain('linkOwnerMismatch');
  });
});

describe('dialogText', () => {
  it('collapses control characters and line breaks, strips bidi controls, and truncates', () => {
    expect(dialogText('a\n\n b\tc\u2028d')).toBe('a b c d');
    expect(dialogText('\u202eevil\u2066\u200f\u061c')).toBe('evil');
    expect(dialogText('x'.repeat(10), 5)).toBe('xxxx…');
    expect(dialogText('😀😀😀', 2)).toBe('😀…');
    expect(dialogText('short')).toBe('short');
  });
});

describe('shouldOfferSignIn', () => {
  // @feature load.deep-link-private
  it('offers sign-in for a gist that is missing or unauthorized while signed out', () => {
    const notFound = new FiddleError(ErrorCode.notFound, 'GitHub responded 404');
    const unauthorized = new FiddleError(ErrorCode.unauthorized, 'GitHub responded 401');
    expect(shouldOfferSignIn(notFound, false)).toBe(true);
    expect(shouldOfferSignIn(unauthorized.toJSON(), false)).toBe(true);
    expect(shouldOfferSignIn(notFound, true)).toBe(false);
    expect(shouldOfferSignIn(new FiddleError(ErrorCode.network, 'offline'), false)).toBe(false);
    expect(shouldOfferSignIn(new Error('boom'), false)).toBe(false);
  });
});
