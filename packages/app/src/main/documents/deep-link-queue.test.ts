import { describe, expect, it, vi } from 'vitest';

import { findDeepLinkInArgv } from '../../fiddle/deep-link';
import { DeepLinkQueue, gistLinkDetail } from './deep-link-queue';

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

  it('keeps only one prompt pending at a time', async () => {
    let release!: () => void;
    const handle = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const onBusy = vi.fn();
    const queue = new DeepLinkQueue(handle, onBusy);
    await queue.start();

    queue.push('electron-fiddle://gist/a');
    expect(queue.busy).toBe(true);
    queue.push('electron-fiddle://gist/b');
    expect(handle).toHaveBeenCalledTimes(1);
    expect(onBusy).toHaveBeenCalledWith('electron-fiddle://gist/b');

    release();
    await vi.waitFor(() => expect(queue.busy).toBe(false));
    queue.push('electron-fiddle://gist/c');
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it('keeps going after a handler fails', async () => {
    const handle = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    const queue = new DeepLinkQueue(handle);
    queue.push('electron-fiddle://gist/a');
    queue.push('electron-fiddle://gist/b');
    await expect(queue.start()).rejects.toThrow('boom');
    expect(queue.busy).toBe(false);
  });

  it('finds links in argv on every platform', () => {
    expect(findDeepLinkInArgv(['/app', '--flag', 'ELECTRON-FIDDLE://gist/abc'])).toBe('ELECTRON-FIDDLE://gist/abc');
    expect(findDeepLinkInArgv(['/app', '.'])).toBeUndefined();
  });
});

describe('gistLinkDetail', () => {
  const t = (key: string, options?: Record<string, string>) =>
    options ? `${key}:${Object.values(options).join('|')}` : key;
  const gist = {
    owner: 'octocat',
    description: 'demo',
    revision: 'b'.repeat(40),
    files: { 'main.js': '', 'package.json': '{}' },
  };

  it('shows the owner, description, revision, files and dependencies', () => {
    const detail = gistLinkDetail({}, gist, { lodash: '^4.0.0' }, t);
    expect(detail.split('\n')).toEqual([
      'detailOwner:octocat',
      'detailDescription:demo',
      `detailRevision:${'b'.repeat(40)}`,
      'detailFiles:main.js, package.json',
      'detailDependencies:lodash@^4.0.0',
      '',
      'linkUntrusted',
    ]);
  });

  it('warns when the owner in the link does not match', () => {
    expect(gistLinkDetail({ owner: 'someone' }, gist, {}, t)).toContain('linkOwnerMismatch:someone|octocat');
    expect(gistLinkDetail({ owner: 'OctoCat' }, gist, {}, t)).not.toContain('linkOwnerMismatch');
  });
});
