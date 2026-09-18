import { beforeEach, describe, expect, it, vi } from 'vitest';

type HeadersListener = (
  details: { responseHeaders: Record<string, string[]> },
  callback: (response: { responseHeaders: Record<string, string[]> }) => void,
) => void;

const webRequest = vi.hoisted(() => ({ onHeadersReceived: vi.fn() }));

vi.mock('electron', () => ({ session: { defaultSession: { webRequest } } }));

import { installDevCsp, PRODUCTION_CSP } from './csp';

function parse(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((directive) => {
      const [name, ...values] = directive.split(' ');
      return [name!, values] as const;
    }),
  );
}

describe('PRODUCTION_CSP', () => {
  const directives = parse(PRODUCTION_CSP);

  it('denies everything by default and allows scripts, workers and connections from the app only', () => {
    expect(directives.get('default-src')).toEqual(["'none'"]);
    expect(directives.get('script-src')).toEqual(["'self'"]);
    expect(directives.get('worker-src')).toEqual(["'self'"]);
    expect(directives.get('connect-src')).toEqual(["'self'"]);
  });

  it('never allows inline or eval script anywhere', () => {
    expect(PRODUCTION_CSP).not.toContain('unsafe-eval');
    expect(PRODUCTION_CSP).not.toContain('wasm-unsafe-eval');
    expect(directives.get('script-src')).not.toContain("'unsafe-inline'");
  });

  it('blocks framing, embedding, forms and base URLs', () => {
    for (const name of [
      'frame-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
    ]) {
      expect(directives.get(name), name).toEqual(["'none'"]);
    }
  });

  it('requires Trusted Types and lists only the policies the app creates', () => {
    expect(directives.get('require-trusted-types-for')).toEqual(["'script'"]);
    const policies = directives.get('trusted-types')!;
    expect(policies).toContain("'allow-duplicates'");
    expect(policies).toContain('fiddleMonacoWorker');
    expect(policies).not.toContain('*');
  });
});

describe('installDevCsp', () => {
  beforeEach(() => webRequest.onHeadersReceived.mockClear());

  function respond(
    url: string,
    headers: Record<string, string[]> = { 'X-Other': ['1'] },
  ) {
    installDevCsp(url);
    const [filter, listener] = webRequest.onHeadersReceived.mock.calls[0] as [
      { urls: string[] },
      HeadersListener,
    ];
    const callback = vi.fn();
    listener({ responseHeaders: headers }, callback);
    const { responseHeaders } = callback.mock.calls[0]![0] as {
      responseHeaders: Record<string, string[]>;
    };
    return { filter, responseHeaders };
  }

  it('applies to the dev server origin only, and keeps the other headers', () => {
    const { filter, responseHeaders } = respond('http://localhost:5173/some/path');
    expect(filter).toEqual({ urls: ['http://localhost:5173/*'] });
    expect(responseHeaders['X-Other']).toEqual(['1']);
  });

  it('differs from the production policy in script-src and connect-src only', () => {
    const { responseHeaders } = respond('http://localhost:5173');
    const dev = parse(responseHeaders['Content-Security-Policy']![0]!);
    const production = parse(PRODUCTION_CSP);
    expect(dev.get('script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(dev.get('connect-src')).toEqual(["'self'", 'ws://localhost:5173']);
    for (const [name, values] of production) {
      if (name !== 'script-src' && name !== 'connect-src')
        expect(dev.get(name), name).toEqual(values);
    }
    expect([...dev.keys()]).toEqual([...production.keys()]);
  });
});
