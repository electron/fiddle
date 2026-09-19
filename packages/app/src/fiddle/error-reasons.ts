import { type ErrorCode, FiddleError } from '../shared/errors';

/**
 * The `details.reason` values that main turns into a translated message. Each
 * has a key of the same name in the `mainErrors` catalog, whose placeholders
 * are named after the error's other details.
 */
export const ERROR_REASONS = [
  'empty-name',
  'path-separator',
  'invalid-character',
  'unsupported-extension',
  'reserved-name',
  'duplicate-name',
  'second-main-entry',
  'no-main-entry',
  'remove-main-entry',
  'file-not-found',
  'folder-not-found',
  'no-supported-files',
  'invalid-json',
  'missing-package-json',
  'invalid-name',
  'invalid-spec',
  'command-not-started',
  'install-failed',
  'registry-metadata',
  'example-not-found',
  'invalid-path',
  'invalid-tag',
  'template-status',
  'template-unreachable',
  'rate-limited',
  'github-response',
  'github-response-detail',
  'timeout',
  'unreachable',
  'too-many-redirects',
  'unexpected-response',
  'too-many-files',
  'file-too-large',
] as const;

export type ErrorReason = (typeof ERROR_REASONS)[number];

/** `message` stays English for logs and tests; main shows the catalog text for `reason`. */
export function reasonError(
  code: ErrorCode,
  reason: ErrorReason,
  message: string,
  details: Record<string, unknown> = {},
): FiddleError {
  return new FiddleError(code, message, { ...details, reason });
}
