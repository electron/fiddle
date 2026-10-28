import { describe, expect, it } from 'vitest';

import { ErrorCode, FiddleError } from '../../../shared/errors';
import { gistErrorHint } from './error-hint';

describe('gistErrorHint', () => {
  it.each([
    ['a 404', ErrorCode.notFound, 'hintOwnership'],
    ['a 403', ErrorCode.forbidden, 'hintOwnership'],
    ['being offline', ErrorCode.network, 'hintConnectivity'],
    ['a rate-limited 403 or a 5xx', ErrorCode.unavailable, 'hintConnectivity'],
    ['a rejected request (422)', ErrorCode.invalidArgument, undefined],
    ['an unexpected response', ErrorCode.internal, undefined],
  ] as const)('maps %s to %s', (_what, code, hint) => {
    expect(gistErrorHint(new FiddleError(code, 'GitHub responded'))).toBe(hint);
  });

  it('gives no hint when the failure reason already says what is wrong', () => {
    const hint = (code: ErrorCode, reason?: string) =>
      gistErrorHint(new FiddleError(code, 'x', reason ? { reason } : undefined));
    expect(hint(ErrorCode.unavailable)).toBe('hintConnectivity');
    expect(hint(ErrorCode.unavailable, 'rate-limited')).toBeUndefined();
    expect(hint(ErrorCode.notFound)).toBe('hintOwnership');
    expect(hint(ErrorCode.notFound, 'no-gist')).toBeUndefined();
  });
});
