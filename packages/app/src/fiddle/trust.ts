/**
 * Where a fiddle's code came from. Serialized as
 * `local`, `example`, `gist:<owner>/<id>@<sha>` or `electron:<tag>/<path>`.
 * A gist's `byOwner` says the code is its owner's: the gist is no fork and `sha` is in its own history.
 */
export type FiddleOrigin =
  | { kind: 'local' }
  | { kind: 'example' }
  | { kind: 'gist'; owner: string; id: string; sha: string; byOwner?: true }
  | { kind: 'electron'; tag: string; path: string };

/** The owner shown for anonymous gists, which have none. */
export const ANONYMOUS_GIST_OWNER = 'anonymous';

export function formatOrigin(origin: FiddleOrigin): string {
  switch (origin.kind) {
    case 'local':
    case 'example':
      return origin.kind;
    case 'gist':
      return `gist:${origin.owner}/${origin.id}@${origin.sha}`;
    case 'electron':
      return `electron:${origin.tag}/${origin.path}`;
  }
}

export function gistOrigin(
  id: string,
  sha: string,
  owner: string | null,
  byOwner = false,
): FiddleOrigin {
  return {
    kind: 'gist',
    owner: owner ?? ANONYMOUS_GIST_OWNER,
    id: id.toLowerCase(),
    sha: sha.toLowerCase(),
    ...(byOwner ? { byOwner: true } : {}),
  };
}

/** Fiddles with a remote origin are untrusted until the user approves them. */
export function isUntrustedOrigin(origin: FiddleOrigin): boolean {
  return origin.kind === 'gist' || origin.kind === 'electron';
}

/**
 * True if `origin` is code the signed-in GitHub user (`login`) wrote: a gist of theirs with
 * `byOwner`. GitHub logins ignore case. Anonymous gists belong to no one.
 */
export function isOwnGist(origin: FiddleOrigin, login: string | undefined): boolean {
  if (origin.kind !== 'gist' || !origin.byOwner || !login) return false;
  if (origin.owner === ANONYMOUS_GIST_OWNER) return false;
  return origin.owner.toLowerCase() === login.toLowerCase();
}

/**
 * True if a code-executing operation (run, module install, auto-bisect,
 * package, make) needs the user's approval first. `approvedOrigin` is the
 * `formatOrigin` string the user last approved for this fiddle.
 */
export function needsApproval(origin: FiddleOrigin, approvedOrigin?: string): boolean {
  return isUntrustedOrigin(origin) && formatOrigin(origin) !== approvedOrigin;
}

/**
 * The origin for a fiddle reloaded from disk (session restore, reopening a
 * folder). A folder load reports `local`, but a saved untrusted fiddle stays
 * untrusted until the user approves it: the first untrusted `remembered`
 * origin wins over `loaded`.
 */
export function restoredOrigin(
  loaded: FiddleOrigin,
  ...remembered: (FiddleOrigin | undefined)[]
): FiddleOrigin {
  return (
    remembered.find((origin) => origin !== undefined && isUntrustedOrigin(origin)) ??
    loaded
  );
}
