/**
 * Where a fiddle's code came from (§4 Trust model). Serialized as
 * `local`, `example`, `gist:<owner>/<id>@<sha>` or `electron:<tag>/<path>`.
 */
export type FiddleOrigin =
  | { kind: 'local' }
  | { kind: 'example' }
  | { kind: 'gist'; owner: string; id: string; sha: string }
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

export function gistOrigin(id: string, sha: string, owner: string | null): FiddleOrigin {
  return { kind: 'gist', owner: owner ?? ANONYMOUS_GIST_OWNER, id: id.toLowerCase(), sha: sha.toLowerCase() };
}

/** Fiddles with a remote origin are untrusted until the user approves them. */
export function isUntrustedOrigin(origin: FiddleOrigin): boolean {
  return origin.kind === 'gist' || origin.kind === 'electron';
}

/**
 * True if a code-executing operation (run, module install, auto-bisect,
 * package, make) needs the user's approval first. `approvedOrigin` is the
 * `formatOrigin` string the user last approved for this fiddle.
 */
export function needsApproval(origin: FiddleOrigin, approvedOrigin?: string): boolean {
  return isUntrustedOrigin(origin) && formatOrigin(origin) !== approvedOrigin;
}
