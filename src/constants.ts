export const SENTRY_DSN =
  'https://966a5b01ac8d4941b81e4ebd0ab4c991@sentry.io/1882540';

export const ELECTRON_DTS = 'electron.d.ts';

// These are the limits GitHub enforces for gist sizes.
// We use these to fail fast locally when creating/updating a new gist.
export const GIST_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
export const GIST_MAX_FILE_COUNT = 300;

export const PREFERS_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
