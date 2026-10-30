import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { InstallState, Installer } from '../src/index.js';

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);
const zipName = (version: string) =>
  `electron-v${version}-${process.platform}-${process.arch}.zip`;

// The second process loads core from source: Node strips the types, and a
// resolve hook maps each `./x.js` import to `./x.ts`. It prints READY, then
// installs, then prints the executable's path.
const CHILD = `
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      if (!specifier.startsWith('.') || !specifier.endsWith('.js')) throw err;
      return next(specifier.slice(0, -3) + '.ts', context);
    }
  },
});
const [source, paths, mirror, version] = process.argv.slice(1);
const { Installer } = await import(source);
const installer = new Installer(JSON.parse(paths), {
  mirror: { electronMirror: mirror },
});
process.stdout.write('READY\\n');
const exec = await installer.install(version);
process.stdout.write('EXEC=' + exec + '\\n');
`;

// A local mirror that serves the fixture zips slowly, so that both processes
// are in flight at once.
let server: http.Server;
let mirror: string;
let zipHits = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const [, version, file] = /^\/v([^/]+)\/(.+)$/.exec(req.url ?? '') ?? [];
    if (file === 'SHASUMS256.txt') {
      fs.createReadStream(fixture('SHASUMS256.txt')).pipe(res);
      return;
    }
    if (version && file === zipName(version)) {
      zipHits++;
      setTimeout(
        () => fs.createReadStream(fixture(`electron-v${version}.zip`)).pipe(res),
        200,
      );
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  mirror = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('two processes sharing one cache', () => {
  let tmpdir: string;
  let paths: { electronDownloads: string; electronVersions: string };

  beforeEach(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
    paths = {
      electronDownloads: path.join(tmpdir, 'downloads'),
      electronVersions: path.join(tmpdir, 'versions'),
    };
    zipHits = 0;
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  /** Starts the second process. Resolves `ready` once it is about to install. */
  function startChild(version: string) {
    const source = pathToFileURL(
      path.join(import.meta.dirname, '..', 'src', 'installer.ts'),
    );
    const child = spawn(
      process.execPath,
      [
        '--experimental-transform-types',
        '--no-warnings',
        '--input-type=module',
        '-e',
        CHILD,
        source.href,
        JSON.stringify(paths),
        mirror,
        version,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let stdout = '';
    const ready = new Promise<void>((resolve) => {
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += String(chunk);
        if (stdout.includes('READY')) resolve();
      });
    });
    const exec = new Promise<string>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => {
        const match = /^EXEC=(.*)$/m.exec(stdout);
        if (code === 0 && match) resolve(match[1]!);
        else reject(new Error(`child exited with ${code}: ${stdout}`));
      });
    });
    return { ready, exec };
  }

  it('installs one version from both at once, downloading and extracting it once', async () => {
    const version = '13.1.7';
    const child = startChild(version);
    await child.ready;
    const installer = new Installer(paths, { mirror: { electronMirror: mirror } });

    const [childExec, exec] = await Promise.all([child.exec, installer.install(version)]);
    const dir = path.join(paths.electronVersions, version);
    expect(childExec).toBe(exec);
    expect(exec).toBe(Installer.getExecPath(dir));
    expect(zipHits).toBe(1);
    expect(fs.readFileSync(path.join(dir, 'version'), 'utf8').trim()).toBe(version);
    expect(fs.readdirSync(paths.electronVersions).sort()).toStrictEqual([
      '.locks',
      version,
    ]);
    expect(fs.readdirSync(path.join(paths.electronVersions, '.locks'))).toStrictEqual([]);
    expect(fs.readdirSync(paths.electronDownloads).sort()).toStrictEqual([
      '.locks',
      zipName(version),
    ]);
  }, 30_000);

  it('installs different versions from both at once', async () => {
    const child = startChild('12.0.15');
    await child.ready;
    const installer = new Installer(paths, { mirror: { electronMirror: mirror } });

    await Promise.all([child.exec, installer.install('13.1.7')]);
    expect(zipHits).toBe(2);
    const fresh = new Installer(paths);
    expect(fresh.state('12.0.15')).toBe(InstallState.installed);
    expect(fresh.state('13.1.7')).toBe(InstallState.installed);
  }, 30_000);
});
