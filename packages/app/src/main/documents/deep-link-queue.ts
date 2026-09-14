/**
 * Delivery of `electron-fiddle://` links (§8): links that arrive before the
 * app is ready are queued, and only one link is handled (one prompt pending)
 * at a time. Also the text of the gist confirmation. No Electron imports.
 */
import type { TFunction } from 'i18next';

import type { GistLoadResult } from '../../fiddle/github';
import { ErrorCode, FiddleError } from '../../shared/errors';

/** How much of one untrusted value a confirmation shows. */
export const DIALOG_TEXT_MAX = 200;

/**
 * Untrusted text (a gist description, owner or file name) for one line of a
 * native dialog, so it can't fake other lines: control characters and line
 * breaks become one space, bidi controls are removed, and it's cut to `max`
 * characters.
 */
export function dialogText(text: string, max = DIALOG_TEXT_MAX): string {
  const chars = Array.from(
    text
      .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
      .replace(/[\p{Cc}\u2028\u2029\s]+/gu, ' ')
      .trim(),
  );
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : chars.join('');
}

/**
 * The deep-link confirmation for a gist (§8): owner (with a warning when the
 * link names someone else), revision SHA, files, dependencies, and last the
 * free-text description. Every gist-controlled value is one sanitized line.
 */
export function gistLinkDetail(
  link: { owner?: string },
  gist: Pick<GistLoadResult, 'owner' | 'description' | 'revision' | 'files'>,
  dependencies: Readonly<Record<string, string>>,
  t: TFunction<'mainDocuments'>,
): string {
  const list = (items: string[]) => (items.length > 0 ? items.map((item) => dialogText(item)).join(', ') : t('none'));
  const owner = gist.owner === null || gist.owner === undefined ? undefined : dialogText(gist.owner);
  const lines: string[] = [t('detailOwner', { owner: owner ?? t('unknownOwner') })];
  if (link.owner && owner && link.owner.toLowerCase() !== owner.toLowerCase()) {
    lines.push(t('linkOwnerMismatch', { linkOwner: dialogText(link.owner), owner }));
  }
  lines.push(
    t('detailRevision', { sha: dialogText(gist.revision) }),
    t('detailFiles', { files: list(Object.keys(gist.files)) }),
    t('detailDependencies', {
      dependencies: list(Object.entries(dependencies).map(([name, spec]) => `${name}@${spec}`)),
    }),
    t('detailDescription', { description: dialogText(gist.description ?? '') || t('none') }),
    '',
    t('linkUntrusted'),
  );
  return lines.join('\n');
}

/**
 * A gist link that fails with "not found" or "unauthorized" while signed out
 * may be a private gist (§17.4): offer to sign in, then try again.
 */
export function shouldOfferSignIn(error: unknown, signedIn: boolean): boolean {
  if (signedIn) return false;
  const { code } = FiddleError.from(error);
  return code === ErrorCode.notFound || code === ErrorCode.unauthorized;
}

/**
 * A gist page URL (`https://gist.github.com/[<owner>/]<id>[/<sha>]`), for
 * example one dropped on the macOS dock icon, as the matching
 * `electron-fiddle://gist/…` link, so it gets the same parsing and trust
 * prompt. Undefined for anything else.
 */
export function gistUrlToDeepLink(text: string): string | undefined {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'gist.github.com' || url.port || url.username || url.password) {
    return undefined;
  }
  const match = /^\/(?:([^/]+)\/)?([0-9a-f]{32})(?:\/([0-9a-f]{40}))?\/?$/i.exec(url.pathname);
  if (!match) return undefined;
  const [, owner, id, sha] = match;
  return `electron-fiddle://gist/${owner ? `${owner}/` : ''}${id}${sha ? `?revision=${sha}` : ''}`;
}

export class DeepLinkQueue {
  #ready = false;
  #busy = false;
  readonly #queued: string[] = [];
  readonly #handle: (url: string) => Promise<void>;
  readonly #onBusy: (url: string) => void;

  /**
   * @param handle Parses, confirms and loads one link. Errors are its to show.
   * @param onBusy Called for a link that arrives while another is pending; it waits its turn.
   */
  constructor(handle: (url: string) => Promise<void>, onBusy: (url: string) => void = () => {}) {
    this.#handle = handle;
    this.#onBusy = onBusy;
  }

  /** Queues a link. Once the app is ready, links are handled in order, one prompt at a time. */
  push(url: string): void {
    this.#queued.push(url);
    if (!this.#ready) return;
    if (this.#busy) this.#onBusy(url);
    else void this.#drain();
  }

  /** The app is ready: handle queued links in order, one at a time. */
  async start(): Promise<void> {
    this.#ready = true;
    await this.#drain();
  }

  get busy(): boolean {
    return this.#busy;
  }

  /** Links waiting for the pending one. */
  get waiting(): number {
    return this.#queued.length;
  }

  async #drain(): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    try {
      while (this.#queued.length > 0) {
        try {
          await this.#handle(this.#queued.shift()!);
        } catch {
          // The handler shows its own errors; the next link still gets its turn.
        }
      }
    } finally {
      this.#busy = false;
    }
  }
}
