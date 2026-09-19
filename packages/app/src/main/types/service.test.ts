import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEndpoints } from '../test-mode';
import { TypesService } from './service';

const UNPKG = getEndpoints().unpkg;

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'fiddle-types-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

interface Fake {
  /** URL suffix (after the unpkg origin) → body, or a status to answer with. */
  routes: Record<string, string | number>;
  urls: string[];
}

function fakeFetch(fake: Fake) {
  return async (url: string): Promise<Response> => {
    fake.urls.push(url);
    const route = fake.routes[url.slice(UNPKG.length)];
    if (route === undefined) return new Response('nope', { status: 404 });
    return typeof route === 'number'
      ? new Response('bad', { status: route })
      : new Response(route);
  };
}

function service(fake: Fake, nodeVersion = '20.9.0') {
  return new TypesService({
    dir,
    fetch: fakeFetch(fake),
    nodeVersionOf: () => nodeVersion,
    onLocalChange: () => undefined,
  });
}

const nodeMeta = (version: string, paths: string[]) =>
  JSON.stringify({
    version,
    files: paths.map((p) => ({ path: p, type: 'file' })),
  });

describe('TypesService.forRelease', () => {
  it('fetches electron.d.ts and the Node types, and caches both on disk', async () => {
    const fake: Fake = {
      routes: {
        '/electron@30.0.0/electron.d.ts': 'declare module "electron" {}',
        '/@types/node@20.9.0/?meta': nodeMeta('20.9.0', [
          '/index.d.ts',
          '/fs.d.ts',
          '/ts5.6/index.d.ts',
          '/README.md',
        ]),
        '/@types/node@20.9.0/index.d.ts': 'index',
        '/@types/node@20.9.0/fs.d.ts': 'fs',
      },
      urls: [],
    };
    const types = await service(fake).forRelease('30.0.0');
    expect(types).toEqual({
      version: '30.0.0',
      electron: 'declare module "electron" {}',
      node: { 'fs.d.ts': 'fs', 'index.d.ts': 'index' },
    });
    expect(await readFile(path.join(dir, 'electron', '30.0.0.d.ts'), 'utf8')).toBe(
      'declare module "electron" {}',
    );
    expect(
      JSON.parse(await readFile(path.join(dir, 'node', '20.9.0.json'), 'utf8')),
    ).toEqual(types.node);

    const before = fake.urls.length;
    await service(fake).forRelease('30.0.0');
    expect(fake.urls).toHaveLength(before);
  });

  it('reads electron-nightly types for a nightly', async () => {
    const fake: Fake = {
      routes: { '/electron-nightly@31.0.0-nightly.20240101/electron.d.ts': 'nightly' },
      urls: [],
    };
    const types = await service(fake, '').forRelease('31.0.0-nightly.20240101');
    expect(types.electron).toBe('nightly');
  });

  it('walks a nested unpkg listing', async () => {
    const meta = JSON.stringify({
      path: '/',
      type: 'directory',
      files: [
        { path: '/index.d.ts', type: 'file' },
        {
          path: '/sub',
          type: 'directory',
          files: [{ path: '/sub/a.d.ts', type: 'file' }],
        },
      ],
    });
    const fake: Fake = {
      routes: {
        '/@types/node@20.9.0/?meta': meta,
        '/@types/node@20.9.0/index.d.ts': 'i',
        '/@types/node@20.9.0/sub/a.d.ts': 'a',
      },
      urls: [],
    };
    expect((await service(fake).forRelease('30.0.0')).node).toEqual({
      'index.d.ts': 'i',
      'sub/a.d.ts': 'a',
    });
  });

  it('falls back to the newest @types/node of the same major when the exact version is not published', async () => {
    const fake: Fake = {
      routes: {
        '/@types/node@20/?meta': nodeMeta('20.11.5', ['/index.d.ts']),
        '/@types/node@20.11.5/index.d.ts': 'index',
      },
      urls: [],
    };
    expect((await service(fake).forRelease('30.0.0')).node).toEqual({
      'index.d.ts': 'index',
    });
    expect(fake.urls).toContain(`${UNPKG}/@types/node@20.9.0/?meta`);
  });

  it('does not cache a set of Node types with files missing, so a later launch fetches it again', async () => {
    const routes: Fake['routes'] = {
      '/@types/node@20.9.0/?meta': nodeMeta('20.9.0', ['/index.d.ts', '/fs.d.ts']),
      '/@types/node@20.9.0/index.d.ts': 'index',
      '/@types/node@20.9.0/fs.d.ts': 503,
    };
    const fake: Fake = { routes, urls: [] };
    expect((await service(fake).forRelease('30.0.0')).node).toEqual({
      'index.d.ts': 'index',
    });
    expect(await readdir(dir).then((names) => names.includes('node'))).toBe(false);

    routes['/@types/node@20.9.0/fs.d.ts'] = 'fs';
    expect((await service(fake).forRelease('30.0.0')).node).toEqual({
      'index.d.ts': 'index',
      'fs.d.ts': 'fs',
    });
    expect(await readdir(path.join(dir, 'node'))).toEqual(['20.9.0.json']);
  });

  it('shares one fetch between concurrent calls', async () => {
    const fake: Fake = { routes: { '/electron@30.0.0/electron.d.ts': 'd' }, urls: [] };
    const types = service(fake, '');
    await Promise.all([types.forRelease('30.0.0'), types.forRelease('30.0.0')]);
    expect(fake.urls.filter((url) => url.endsWith('electron.d.ts'))).toHaveLength(1);
  });

  it('answers null when electron.d.ts cannot be fetched', async () => {
    const types = await service({ routes: {}, urls: [] }, '').forRelease('30.0.0');
    expect(types).toEqual({ version: '30.0.0', electron: null, node: {} });
  });
});

describe('TypesService.forLocal', () => {
  it('reads a local build’s electron.d.ts', async () => {
    const build = path.join(dir, 'build');
    await mkdir(path.join(build, 'gen', 'electron', 'tsc', 'typings'), {
      recursive: true,
    });
    await writeFile(
      path.join(build, 'gen', 'electron', 'tsc', 'typings', 'electron.d.ts'),
      'local',
    );
    const onLocalChange = vi.fn();
    const types = new TypesService({
      dir,
      fetch: fakeFetch({ routes: {}, urls: [] }),
      nodeVersionOf: () => undefined,
      onLocalChange,
    });
    expect(
      await types.forLocal({ id: 'b', name: 'My build', path: build } as never),
    ).toEqual({
      version: 'My build',
      electron: 'local',
      node: {},
    });
    expect(
      await types.forLocal({
        id: 'gone',
        name: 'Gone',
        path: path.join(dir, 'missing'),
      } as never),
    ).toMatchObject({
      electron: null,
    });
  });

  describe('watching', () => {
    afterEach(() => vi.restoreAllMocks());

    async function watched() {
      const build = path.join(dir, 'build');
      const typings = path.join(build, 'gen', 'electron', 'tsc', 'typings');
      await mkdir(typings, { recursive: true });
      await writeFile(path.join(typings, 'electron.d.ts'), 'local');
      const closed = vi.fn();
      const watchers: EventEmitter[] = [];
      vi.spyOn(fs, 'watch').mockImplementation(() => {
        const watcher = Object.assign(new EventEmitter(), { close: closed });
        watchers.push(watcher);
        return watcher as never;
      });
      const types = new TypesService({
        dir,
        fetch: fakeFetch({ routes: {}, urls: [] }),
        nodeVersionOf: () => undefined,
        onLocalChange: () => undefined,
      });
      const open = () => types.forLocal({ id: 'b', name: 'B', path: build } as never);
      return { types, open, closed, watchers };
    }

    it('watches a build once, and stops when the build is gone', async () => {
      const { types, open, closed } = await watched();
      await open();
      await open();
      expect(fs.watch).toHaveBeenCalledTimes(1);
      types.retainWatches(new Set(['b']));
      expect(closed).not.toHaveBeenCalled();
      types.retainWatches(new Set());
      expect(closed).toHaveBeenCalledOnce();
      await open();
      expect(fs.watch).toHaveBeenCalledTimes(2);
    });

    it('closes a watcher that failed, so the build can be watched again', async () => {
      const { open, closed, watchers } = await watched();
      await open();
      watchers[0]!.emit('error', new Error('EPERM'));
      expect(closed).toHaveBeenCalledOnce();
      await open();
      expect(fs.watch).toHaveBeenCalledTimes(2);
    });
  });
});
