import { ErrorCode, FiddleError } from '../shared/errors';

/**
 * Where a fiddle's code came from (§4 Trust model). Serialized as
 * `local`, `example`, `gist:<owner>/<id>@<sha>` or `electron:<tag>/<path>`.
 */
export type FiddleOrigin =
  | { kind: 'local' }
  | { kind: 'example' }
  | { kind: 'gist'; owner: string; id: string; sha: string }
  | { kind: 'electron'; tag: string; path: string };

export const CODE_EXECUTING_OPERATIONS = ['run', 'install-modules', 'auto-bisect', 'package', 'make'] as const;
export type CodeExecutingOperation = (typeof CODE_EXECUTING_OPERATIONS)[number];

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

const GIST_ORIGIN_RE = /^gist:([^/@]+)\/([0-9a-f]{32})@([0-9a-f]{40})$/i;
const ELECTRON_ORIGIN_RE = /^electron:([^/]+)\/(.+)$/;

export function parseOrigin(text: string): FiddleOrigin {
  if (text === 'local' || text === 'example') return { kind: text };
  const gist = GIST_ORIGIN_RE.exec(text);
  if (gist) return { kind: 'gist', owner: gist[1]!, id: gist[2]!.toLowerCase(), sha: gist[3]!.toLowerCase() };
  const electron = ELECTRON_ORIGIN_RE.exec(text);
  if (electron) return { kind: 'electron', tag: electron[1]!, path: electron[2]! };
  throw new FiddleError(ErrorCode.invalidArgument, `Unknown fiddle origin: ${text}`, { origin: text });
}

/** Fiddles with a remote origin are untrusted until the user approves them. */
export function isUntrustedOrigin(origin: FiddleOrigin): boolean {
  return origin.kind === 'gist' || origin.kind === 'electron';
}

export function isCodeExecutingOperation(operation: string): operation is CodeExecutingOperation {
  return (CODE_EXECUTING_OPERATIONS as readonly string[]).includes(operation);
}

/** True if running `operation` on a fiddle from `origin` needs the user's approval first. */
export function needsApproval(origin: FiddleOrigin, operation: string, approved: boolean): boolean {
  return !approved && isUntrustedOrigin(origin) && isCodeExecutingOperation(operation);
}
