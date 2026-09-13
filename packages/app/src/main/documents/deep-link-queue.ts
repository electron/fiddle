/**
 * Delivery of `electron-fiddle://` links (§8): links that arrive before the
 * app is ready are queued, and only one link is handled (one prompt pending)
 * at a time. Also the text of the gist confirmation. No Electron imports.
 */
import type { GistLoadResult } from '../../fiddle/github';

type DetailKey =
  | 'detailOwner'
  | 'linkOwnerMismatch'
  | 'detailDescription'
  | 'detailRevision'
  | 'detailFiles'
  | 'detailDependencies'
  | 'linkUntrusted'
  | 'none'
  | 'unknownOwner';

/**
 * The deep-link confirmation for a gist (§8): owner (with a warning when the
 * link names someone else), description, revision SHA, files and dependencies.
 */
export function gistLinkDetail(
  link: { owner?: string },
  gist: Pick<GistLoadResult, 'owner' | 'description' | 'revision' | 'files'>,
  dependencies: Readonly<Record<string, string>>,
  t: (key: DetailKey, options?: Record<string, string>) => string,
): string {
  const list = (items: string[]) => (items.length > 0 ? items.join(', ') : t('none'));
  const lines = [t('detailOwner', { owner: gist.owner ?? t('unknownOwner') })];
  if (link.owner && gist.owner && link.owner.toLowerCase() !== gist.owner.toLowerCase()) {
    lines.push(t('linkOwnerMismatch', { linkOwner: link.owner, owner: gist.owner }));
  }
  lines.push(
    t('detailDescription', { description: gist.description || t('none') }),
    t('detailRevision', { sha: gist.revision }),
    t('detailFiles', { files: list(Object.keys(gist.files)) }),
    t('detailDependencies', {
      dependencies: list(Object.entries(dependencies).map(([name, spec]) => `${name}@${spec}`)),
    }),
    '',
    t('linkUntrusted'),
  );
  return lines.join('\n');
}

export class DeepLinkQueue {
  #ready = false;
  #busy = false;
  readonly #queued: string[] = [];
  readonly #handle: (url: string) => Promise<void>;
  readonly #onBusy: (url: string) => void;

  /**
   * @param handle Parses, confirms and loads one link. Errors are its to show.
   * @param onBusy Called for a link that arrives while another is pending.
   */
  constructor(handle: (url: string) => Promise<void>, onBusy: (url: string) => void = () => {}) {
    this.#handle = handle;
    this.#onBusy = onBusy;
  }

  push(url: string): void {
    if (!this.#ready) {
      this.#queued.push(url);
      return;
    }
    void this.#run(url);
  }

  /** The app is ready: handle queued links in order, one at a time. */
  async start(): Promise<void> {
    this.#ready = true;
    while (this.#queued.length > 0) await this.#run(this.#queued.shift()!);
  }

  get busy(): boolean {
    return this.#busy;
  }

  async #run(url: string): Promise<void> {
    if (this.#busy) {
      this.#onBusy(url);
      return;
    }
    this.#busy = true;
    try {
      await this.#handle(url);
    } finally {
      this.#busy = false;
    }
  }
}
