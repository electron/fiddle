import fs from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { ERROR_REASONS, reasonError } from '../fiddle/error-reasons';
import { assertValidFileName, fileRuleError } from '../fiddle/files';
import { forgeTransform } from '../fiddle/forge';
import { assertGistFiles } from '../fiddle/github';
import { assertModuleSpec, runCommand } from '../fiddle/modules';
import { parsePackageJson } from '../fiddle/package-json';
import { ErrorCode, FiddleError } from '../shared/errors';
import { initMainI18n } from './i18n';
import { errorMessage, localizeError } from './localize-error';

beforeAll(async () => {
  await initMainI18n(['en']);
});

function thrown(fn: () => unknown): FiddleError {
  try {
    fn();
  } catch (error) {
    return error as FiddleError;
  }
  throw new Error('did not throw');
}

describe('the mainErrors catalog', () => {
  it('has a key for every reason, and no others', () => {
    const catalog = JSON.parse(
      fs.readFileSync(
        new URL('../i18n/locales/en/mainErrors.json', import.meta.url),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(Object.keys(catalog).sort()).toEqual([...ERROR_REASONS].sort());
  });
});

describe('localizeError', () => {
  it('fills the message from the details and keeps the code and details', () => {
    const error = fileRuleError('duplicate-name', 'a.js');
    const localized = localizeError(error);
    expect(localized.message).toBe('A file named “a.js” already exists.');
    expect(localized.code).toBe(ErrorCode.invalidArgument);
    expect(localized.details).toEqual(error.details);
  });

  it('passes the server text through as a placeholder value', () => {
    const error = reasonError(ErrorCode.notFound, 'github-response-detail', 'English', {
      status: 404,
      detail: 'Not Found {{status}}',
    });
    expect(localizeError(error).message).toBe(
      'GitHub answered with HTTP 404: Not Found {{status}}',
    );
  });

  it('returns other errors as they are', () => {
    const noDetails = new FiddleError(ErrorCode.notFound, 'Gone');
    const noReason = new FiddleError(ErrorCode.notFound, 'Gone', { name: 'x' });
    const unmapped = new FiddleError(ErrorCode.unauthorized, 'Gone', {
      reason: 'signed-out',
    });
    const primitive = new FiddleError(ErrorCode.notFound, 'Gone', 'x');
    for (const error of [noDetails, noReason, unmapped, primitive]) {
      expect(localizeError(error)).toBe(error);
    }
  });

  it('gives every error thrown from src/fiddle a complete sentence', async () => {
    const start = await runCommand({ command: 'fiddle-no-such-command', args: [] }).then(
      () => undefined,
      (error: unknown) => error as FiddleError,
    );
    const errors = [
      thrown(() => assertValidFileName('')),
      thrown(() => assertValidFileName('a/b.js')),
      thrown(() => assertValidFileName('a:b.js')),
      thrown(() => assertValidFileName('package.json')),
      thrown(() => assertValidFileName('a.txt')),
      thrown(() => assertModuleSpec('@bad name', '1.0.0')),
      thrown(() => assertModuleSpec('a', 'git+ssh://x')),
      thrown(() => parsePackageJson('{')),
      thrown(() => forgeTransform({}, { forgeVersion: '7.0.0' })),
      thrown(() => assertGistFiles({ 'big.js': 'x'.repeat(10 * 1024 * 1024 + 1) })),
      thrown(() =>
        assertGistFiles(
          Object.fromEntries(Array.from({ length: 301 }, (_, i) => [`${i}.js`, 'x'])),
        ),
      ),
      start,
    ];
    expect(errors.every((e) => e instanceof FiddleError)).toBe(true);
    for (const error of errors) {
      const message = localizeError(error!).message;
      expect(message, error!.message).not.toBe(error!.message);
      expect(message).not.toContain('{{');
      expect(message).not.toBe((error!.details as { reason: string }).reason);
    }
  });
});

describe('errorMessage', () => {
  it('localizes a FiddleError and passes any other error through', () => {
    expect(errorMessage(fileRuleError('empty-name', ''))).toBe(
      "A file name can't be empty.",
    );
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });
});
