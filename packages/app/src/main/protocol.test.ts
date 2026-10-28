import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const protocol = vi.hoisted(() => ({
  handle: vi.fn(),
  registerSchemesAsPrivileged: vi.fn(),
}));

vi.mock('electron', () => ({ protocol }));
vi.mock('./log');

import { PRODUCTION_CSP } from './csp';
import { handleAppProtocol, registerAppScheme } from './protocol';

let dir: string;

type Handler = (request: { method: string; url: string }) => Promise<Response>;

async function serve(): Promise<Handler> {
  await handleAppProtocol(dir);
  return protocol.handle.mock.calls[0]![1] as Handler;
}

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'fiddle-protocol-'));
  await fsp.mkdir(path.join(dir, 'assets'));
  await fsp.writeFile(path.join(dir, 'index.html'), '<html></html>');
  await fsp.writeFile(path.join(dir, 'assets', 'app.js'), 'export {}');
  await fsp.writeFile(path.join(dir, 'secret.txt'), 'not in the bundle');
  await fsp.writeFile(
    path.join(dir, 'bundle-manifest.json'),
    JSON.stringify({ files: ['index.html', 'assets/app.js'] }),
  );
  protocol.handle.mockClear();
  protocol.registerSchemesAsPrivileged.mockClear();
});

afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('registerAppScheme', () => {
  it('registers app:// as a secure standard scheme that does not bypass the CSP', () => {
    registerAppScheme();
    const [[schemes]] = protocol.registerSchemesAsPrivileged.mock.calls as [
      [{ scheme: string; privileges: Record<string, unknown> }[]],
    ];
    expect(schemes).toHaveLength(1);
    expect(schemes[0]!.scheme).toBe('app');
    expect(schemes[0]!.privileges).toMatchObject({ standard: true, secure: true });
    expect(schemes[0]!.privileges).not.toHaveProperty('bypassCSP');
    expect(schemes[0]!.privileges).not.toHaveProperty('allowServiceWorkers');
  });
});

describe('handleAppProtocol', () => {
  it('serves a listed file with its type, the CSP and nosniff', async () => {
    const handler = await serve();
    const response = await handler({ method: 'GET', url: 'app://main/assets/app.js' });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('export {}');
    expect(response.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8');
    expect(response.headers.get('Content-Security-Policy')).toBe(PRODUCTION_CSP);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect((await handler({ method: 'GET', url: 'app://main/' })).status).toBe(200);
  });

  it('answers 404 with the same security headers for anything else', async () => {
    const handler = await serve();
    const refused = [
      { method: 'POST', url: 'app://main/index.html' },
      { method: 'PUT', url: 'app://main/assets/app.js' },
      { method: 'GET', url: 'app://main/secret.txt' },
      { method: 'GET', url: 'app://main/bundle-manifest.json' },
      { method: 'GET', url: 'app://main/../secret.txt' },
      { method: 'GET', url: 'app://main/%2e%2e/secret.txt' },
      { method: 'GET', url: 'app://other/index.html' },
    ];
    for (const request of refused) {
      const response = await handler(request);
      expect(response.status, `${request.method} ${request.url}`).toBe(404);
      expect(response.headers.get('Content-Security-Policy')).toBe(PRODUCTION_CSP);
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }
  });

  it('fails when the bundle has no manifest', async () => {
    await fsp.rm(path.join(dir, 'bundle-manifest.json'));
    await expect(handleAppProtocol(dir)).rejects.toThrow();
  });
});
