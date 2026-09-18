/**
 * The local fixture server behind every endpoint in test mode
 * (src/shared/endpoints.ts `fixtureEndpoints`). It listens on 127.0.0.1 and
 * records every request, so specs can assert on traffic.
 *
 * Routes, relative to its URL:
 *   /releases.json                         data/releases.json
 *   /electron-mirror/<v>/<file>            Electron zips from a local cache, and SHASUMS256.txt;
 *                                          other versions get the installed Electron's zip
 *   /nightly-mirror/<v>/<file>             the same
 *   /github-api/user                       a signed-in user whose token has the gist scope
 *   /github-api/gists/<id>[/<sha>]         data/gists/<id>.json, or a gist created here (GET);
 *                                          create (POST), update (PATCH), delete (DELETE), kept in memory
 *   /github-api/gists/<id>/commits         the gist's `history`
 *   /gist-raw/<owner>/<id>/raw/<rev>/<f>   a file from data/gists/<id>.json
 *   /unpkg/<pkg>@<v>/<path>.d.ts, ?meta    small type definitions
 *   /algolia/1/indexes/...                 data/npm-search.json
 *   /npm/<name>                            a packument with versions 1.0.0 and 1.1.0 (latest)
 *   /minimal-repro/archive/<branch>.zip    data/minimal-repro/ as a zip
 *
 * Electron zips come from FIDDLE_E2E_ELECTRON_ZIPS (a directory), ELECTRON_CACHE
 * or @electron/get's default cache (where CI's cached download lands). If the
 * installed Electron's zip isn't there and `zip` is available, one is made from
 * node_modules/electron/dist.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeZip } from './zip.ts';

const FIXTURES = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(FIXTURES, 'data');
const APP_DIR = path.resolve(FIXTURES, '..', '..');

export interface FixtureRequest {
  method: string;
  path: string;
  status: number;
  body?: string;
}

export interface FixtureServer {
  /** e.g. `http://127.0.0.1:43210`, no trailing slash. */
  url: string;
  requests: FixtureRequest[];
  close(): Promise<void>;
}

/** The fixture gist every spec can load. */
export const FIXTURE_GIST_ID = 'c0ffee00c0ffee00c0ffee00c0ffee00';

type Reply =
  | {
      status: number;
      type: string;
      body: Buffer | string;
      headers?: Record<string, string>;
    }
  | { file: string };

const json = (value: unknown, status = 200): Reply => ({
  status,
  type: 'application/json',
  body: JSON.stringify(value),
});
const text = (body: string, status = 200, type = 'text/plain'): Reply => ({
  status,
  type,
  body,
});
const notFound = (what: string): Reply =>
  text(`fixture server: no fixture for ${what}\n`, 404);

function readData(file: string): string {
  return fs.readFileSync(path.join(DATA, file), 'utf8');
}

function electronCacheDirs(): string[] {
  const home = os.homedir();
  const dirs = [
    process.env.FIDDLE_E2E_ELECTRON_ZIPS,
    process.env.ELECTRON_CACHE,
    process.platform === 'darwin'
      ? path.join(home, 'Library', 'Caches', 'electron')
      : process.platform === 'win32'
        ? path.join(
            process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'),
            'electron',
            'Cache',
          )
        : path.join(process.env.XDG_CACHE_HOME ?? path.join(home, '.cache'), 'electron'),
    path.join(APP_DIR, 'node_modules', '.cache', 'fiddle-e2e'),
  ];
  return dirs.filter((dir): dir is string => !!dir && fs.existsSync(dir));
}

/** Finds `file` in a cache dir, directly or one level down (@electron/get's layout). */
function findInCache(file: string): string | undefined {
  for (const dir of electronCacheDirs()) {
    const direct = path.join(dir, file);
    if (fs.existsSync(direct)) return direct;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const nested = path.join(dir, entry.name, file);
      if (entry.isDirectory() && fs.existsSync(nested)) return nested;
    }
  }
  return undefined;
}

function installedElectron(): { version: string; dist: string } | undefined {
  try {
    const require = createRequire(path.join(APP_DIR, 'package.json'));
    const pkgFile = require.resolve('electron/package.json');
    const { version } = JSON.parse(fs.readFileSync(pkgFile, 'utf8')) as {
      version: string;
    };
    return { version, dist: path.join(path.dirname(pkgFile), 'dist') };
  } catch {
    return undefined;
  }
}

function findElectronZip(file: string): string | undefined {
  const cached = findInCache(file);
  if (cached) return cached;
  const installed = installedElectron();
  const wanted =
    installed && `electron-v${installed.version}-${process.platform}-${process.arch}.zip`;
  if (!installed || file !== wanted || !fs.existsSync(installed.dist)) return undefined;
  const out = path.join(APP_DIR, 'node_modules', '.cache', 'fiddle-e2e', file);
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync('zip', ['-qry', `${out}.tmp`, '.'], { cwd: installed.dist });
    fs.renameSync(`${out}.tmp`, out);
    return out;
  } catch {
    return undefined;
  }
}

const hashes = new Map<string, string>();

function sha256(file: string): string {
  let hash = hashes.get(file);
  if (!hash) {
    hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    hashes.set(file, hash);
  }
  return hash;
}

/**
 * The zip for `file`, or else the installed Electron's zip under that name,
 * so specs can switch between the fixture's versions offline.
 */
function zipFor(file: string): string | undefined {
  const zip = findElectronZip(file);
  if (zip) return zip;
  const installed = installedElectron();
  const suffix = `-${process.platform}-${process.arch}.zip`;
  if (!installed || !file.startsWith('electron-v') || !file.endsWith(suffix))
    return undefined;
  return findElectronZip(`electron-v${installed.version}${suffix}`);
}

function electronMirror(dir: string, file: string): Reply {
  if (file === 'SHASUMS256.txt') {
    const lines: string[] = [];
    for (const name of [`electron-${dir}-${process.platform}-${process.arch}.zip`]) {
      const zip = zipFor(name);
      if (zip) lines.push(`${sha256(zip)} *${name}`);
    }
    return lines.length > 0
      ? text(`${lines.join('\n')}\n`)
      : notFound(`SHASUMS256.txt for ${dir}`);
  }
  const zip = file.endsWith('.zip') ? zipFor(file) : undefined;
  return zip ? { file: zip } : notFound(`${dir}/${file} (no cached Electron zip)`);
}

interface GistFile {
  filename?: string;
  content: string;
}

function loadGist(id: string, base: string): Record<string, unknown> | undefined {
  const file = path.join(DATA, 'gists', `${id}.json`);
  if (!fs.existsSync(file)) return undefined;
  const gist = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    owner?: { login: string };
    files: Record<string, GistFile>;
  };
  const owner = gist.owner?.login ?? 'fiddle-e2e';
  const files = Object.fromEntries(
    Object.entries(gist.files).map(([name, entry]) => [
      name,
      {
        filename: name,
        type: 'text/plain',
        size: entry.content.length,
        truncated: false,
        content: entry.content,
        raw_url: `${base}/gist-raw/${owner}/${id}/raw/0/${name}`,
      },
    ]),
  );
  return {
    ...gist,
    id,
    url: `${base}/github-api/gists/${id}`,
    html_url: `https://gist.github.com/${owner}/${id}`,
    files,
  };
}

/** Files as GitHub returns them: `null` in a PATCH deletes, anything else adds or replaces. */
function applyFiles(
  current: Record<string, unknown>,
  changes: Record<string, GistFile | null> = {},
): Record<string, unknown> {
  const files = { ...current };
  for (const [name, change] of Object.entries(changes)) {
    if (change)
      files[name] = {
        filename: name,
        type: 'text/plain',
        size: change.content.length,
        content: change.content,
      };
    else delete files[name];
  }
  return files;
}

/** Gists created, updated or deleted through this process's fixture servers. `null` is deleted. */
const written = new Map<string, Record<string, unknown> | null>();

function revision(seed: string, changes: number) {
  return {
    version: crypto.createHash('sha1').update(seed).digest('hex'),
    committed_at: new Date(Date.UTC(2026, 1, 1) + written.size * 60_000).toISOString(),
    change_status: { total: changes, additions: changes, deletions: 0 },
  };
}

function github(method: string, parts: string[], body: string, base: string): Reply {
  const [resource, id, sub] = parts;
  if (resource === 'user' && method === 'GET') {
    return {
      ...json({ login: 'fiddle-e2e', id: 1, name: 'Fiddle E2E', avatar_url: '' }),
      headers: { 'X-OAuth-Scopes': 'gist' },
    } as Reply;
  }
  if (resource !== 'gists') return notFound(`GitHub ${parts.join('/')}`);
  if (method === 'POST' && !id) {
    const input = JSON.parse(body || '{}') as {
      description?: string;
      public?: boolean;
      files?: Record<string, GistFile>;
    };
    const first = revision(body, Object.keys(input.files ?? {}).length);
    const newId = first.version.slice(0, 32);
    const gist = {
      id: newId,
      description: input.description ?? '',
      public: input.public ?? false,
      url: `${base}/github-api/gists/${newId}`,
      html_url: `https://gist.github.com/fiddle-e2e/${newId}`,
      files: applyFiles({}, input.files),
      owner: { login: 'fiddle-e2e' },
      history: [first],
    };
    written.set(newId, gist);
    return json(gist, 201);
  }
  if (!id) return notFound('GitHub gists listing');
  const gist = written.has(id) ? written.get(id) : loadGist(id, base);
  if (!gist) return json({ message: 'Not Found' }, 404);
  if (method === 'DELETE') {
    written.set(id, null);
    return { status: 204, type: 'text/plain', body: '' };
  }
  if (method === 'PATCH') {
    const input = JSON.parse(body || '{}') as {
      description?: string;
      files?: Record<string, GistFile | null>;
    };
    const updated = {
      ...gist,
      ...(input.description === undefined ? {} : { description: input.description }),
      files: applyFiles(gist.files as Record<string, unknown>, input.files),
      history: [
        revision(`${id}${body}`, Object.keys(input.files ?? {}).length),
        ...((gist.history as unknown[]) ?? []),
      ],
    };
    written.set(id, updated);
    return json(updated);
  }
  if (sub === 'commits') return json(gist.history ?? []);
  // `/gists/<id>` or `/gists/<id>/<sha>`: the fixture has the same files at every revision.
  return json(gist);
}

function gistRaw(parts: string[], base: string): Reply {
  // <owner>/<id>/raw/<rev>/<file>
  const [, id, , , ...rest] = parts;
  const gist = id ? loadGist(id, base) : undefined;
  const files = gist?.files as Record<string, { content: string }> | undefined;
  const entry = files?.[rest.join('/')];
  return entry ? text(entry.content) : notFound(`raw gist file ${parts.join('/')}`);
}

function unpkg(pathname: string, search: string): Reply {
  if (search === '?meta') {
    return json({
      path: '/',
      type: 'directory',
      files: [{ path: '/index.d.ts', type: 'file' }],
    });
  }
  if (!pathname.endsWith('.d.ts')) return notFound(`unpkg ${pathname}`);
  return text(readData(pathname.includes('/electron') ? 'electron.d.ts' : 'node.d.ts'));
}

function npm(parts: string[]): Reply {
  const name = decodeURIComponent(parts.join('/'));
  if (!name) return notFound('npm registry root');
  const version = (v: string) => ({ name, version: v, dist: { tarball: '' } });
  return json({
    name,
    'dist-tags': { latest: '1.1.0' },
    versions: { '1.0.0': version('1.0.0'), '1.1.0': version('1.1.0') },
  });
}

function minimalRepro(parts: string[]): Reply {
  const branch = parts[1]?.replace(/\.zip$/, '');
  if (parts[0] !== 'archive' || !branch)
    return notFound(`minimal-repro ${parts.join('/')}`);
  const dir = path.join(DATA, 'minimal-repro');
  const files = Object.fromEntries(
    fs
      .readdirSync(dir)
      .map((name) => [
        `minimal-repro-${branch}/${name}`,
        fs.readFileSync(path.join(dir, name)),
      ]),
  );
  return { status: 200, type: 'application/zip', body: makeZip(files) };
}

function route(method: string, url: URL, body: string, base: string): Reply {
  const [top = '', ...parts] = url.pathname.split('/').filter(Boolean);
  switch (top) {
    case 'releases.json':
      return text(readData('releases.json'), 200, 'application/json');
    case 'electron-mirror':
    case 'nightly-mirror':
      return electronMirror(parts[0] ?? '', parts.slice(1).join('/'));
    case 'github-api':
      return github(method, parts, body, base);
    case 'gist-raw':
      return gistRaw(parts, base);
    case 'unpkg':
      return unpkg(url.pathname, url.search);
    case 'algolia': {
      const result = JSON.parse(readData('npm-search.json')) as unknown;
      return json(url.pathname.endsWith('/queries') ? { results: [result] } : result);
    }
    case 'npm':
      return npm(parts);
    case 'minimal-repro':
      return minimalRepro(parts);
    default:
      return notFound(url.pathname);
  }
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const requests: FixtureRequest[] = [];
  let base = '';
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const method = request.method ?? 'GET';
      const url = new URL(request.url ?? '/', base);
      let reply: Reply;
      try {
        reply = route(method, url, body, base);
      } catch (error) {
        reply = text(`fixture server error: ${String(error)}\n`, 500);
      }
      const status = 'file' in reply ? 200 : reply.status;
      requests.push({
        method,
        path: url.pathname + url.search,
        status,
        ...(body ? { body } : {}),
      });
      response.setHeader('Access-Control-Allow-Origin', '*');
      if ('file' in reply) {
        response.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': fs.statSync(reply.file).size,
        });
        fs.createReadStream(reply.file).pipe(response);
        return;
      }
      response.writeHead(reply.status, { 'Content-Type': reply.type, ...reply.headers });
      response.end(reply.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('fixture server has no port');
  base = `http://127.0.0.1:${address.port}`;
  return {
    url: base,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
