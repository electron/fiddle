import type { TFunction } from 'i18next';

import type { GistLoadResult } from '../../fiddle/github';
import { ErrorCode, FiddleError } from '../../shared/errors';

/** How much of one untrusted value a confirmation shows. */
export const DIALOG_TEXT_MAX = 200;

/**
 * Untrusted text for one line of a native dialog, so it can't fake other lines: control
 * characters and line breaks become one space, bidi controls go, and it's cut to `max` characters.
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

/** Every gist-controlled value is one sanitized line, and the free-text description comes last. */
export function gistLinkDetail(
  link: { owner?: string },
  gist: Pick<GistLoadResult, 'owner' | 'description' | 'revision' | 'files'>,
  dependencies: Readonly<Record<string, string>>,
  t: TFunction<'mainDocuments'>,
): string {
  const list = (items: string[]) =>
    items.length > 0 ? items.map((item) => dialogText(item)).join(', ') : t('none');
  const owner =
    gist.owner === null || gist.owner === undefined ? undefined : dialogText(gist.owner);
  const lines: string[] = [t('detailOwner', { owner: owner ?? t('unknownOwner') })];
  if (link.owner && owner && link.owner.toLowerCase() !== owner.toLowerCase()) {
    lines.push(t('linkOwnerMismatch', { linkOwner: dialogText(link.owner), owner }));
  }
  lines.push(
    t('detailRevision', { sha: dialogText(gist.revision) }),
    t('detailFiles', { files: list(Object.keys(gist.files)) }),
    t('detailDependencies', {
      dependencies: list(
        Object.entries(dependencies).map(([name, spec]) => `${name}@${spec}`),
      ),
    }),
    t('detailDescription', {
      description: dialogText(gist.description ?? '') || t('none'),
    }),
    '',
    t('linkUntrusted'),
  );
  return lines.join('\n');
}

/** A gist link that isn't found while signed out may be a private gist. */
export function shouldOfferSignIn(error: unknown, signedIn: boolean): boolean {
  if (signedIn) return false;
  const { code } = FiddleError.from(error);
  return code === ErrorCode.notFound || code === ErrorCode.unauthorized;
}

/** A gist page URL as the matching `electron-fiddle://gist/…` link, so it gets the same trust prompt. Undefined for anything else. */
export function gistUrlToDeepLink(text: string): string | undefined {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return undefined;
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'gist.github.com' ||
    url.port ||
    url.username ||
    url.password
  ) {
    return undefined;
  }
  const match = /^\/(?:([^/]+)\/)?([0-9a-f]{32})(?:\/([0-9a-f]{40}))?\/?$/i.exec(
    url.pathname,
  );
  if (!match) return undefined;
  const [, owner, id, sha] = match;
  return `electron-fiddle://gist/${owner ? `${owner}/` : ''}${id}${sha ? `?revision=${sha}` : ''}`;
}

/** Links that arrive before `start()` wait for it; after that they're handled in order, one prompt at a time. */
export class DeepLinkQueue {
  #started = false;
  #pending = 0;
  #open!: () => void;
  #tail = new Promise<void>((resolve) => (this.#open = resolve));
  readonly #handle: (url: string) => Promise<void>;
  readonly #onBusy: (url: string) => void;

  /**
   * @param handle Parses, confirms and loads one link. Errors are its to show.
   * @param onBusy Called for a link that arrives while another is pending; it waits its turn.
   */
  constructor(
    handle: (url: string) => Promise<void>,
    onBusy: (url: string) => void = () => {},
  ) {
    this.#handle = handle;
    this.#onBusy = onBusy;
  }

  push(url: string): void {
    if (this.#started && this.#pending > 0) this.#onBusy(url);
    this.#pending++;
    this.#tail = this.#tail
      .then(() => this.#handle(url))
      // The handler shows its own errors; the next link still gets its turn.
      .catch(() => undefined)
      .finally(() => this.#pending--);
  }

  /** Resolves once the links pushed so far are handled. */
  start(): Promise<void> {
    this.#started = true;
    this.#open();
    return this.#tail;
  }
}
