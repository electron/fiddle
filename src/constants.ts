export const SENTRY_DSN =
  'https://966a5b01ac8d4941b81e4ebd0ab4c991@sentry.io/1882540';

export const ELECTRON_DTS = 'electron.d.ts';

// Matches GitHub personal access tokens (classic `ghp_` and fine-grained
// `github_pat_`). Used in both the renderer (clipboard sniff) and the main
// process (sign-in validation), so they stay in lockstep.
export const GITHUB_TOKEN_PATTERN =
  /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})$/;

// GitHub gist limits. Enforced when creating/updating a gist so we fail
// fast in main instead of round-tripping to the API. Shared with tests.
export const GIST_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
export const GIST_MAX_FILE_COUNT = 300;
