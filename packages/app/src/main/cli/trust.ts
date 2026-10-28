import type { FileMap } from '../../fiddle/files';
import { formatOrigin, isUntrustedOrigin, type FiddleOrigin } from '../../fiddle/trust';
import { FiddleError } from '../../shared/errors';
import { trustDetail } from '../documents/deep-link-queue';
import { tm } from '../i18n';
import { t } from './argv';
import { CliErrorCode } from './output';

export interface TrustPrompt {
  /** False when stdin isn't a terminal, so nobody can answer. */
  readonly interactive: boolean;
  ask(detail: string, question: string): Promise<string>;
}

/** A remote fiddle needs `--trust` or a "y" at a terminal prompt; with neither it fails closed with `untrusted` before anything is written or run. */
export async function ensureTrusted(
  fiddle: { origin: FiddleOrigin; files: FileMap },
  modules: Readonly<Record<string, string>>,
  trust: boolean,
  prompt: TrustPrompt,
): Promise<void> {
  if (!isUntrustedOrigin(fiddle.origin) || trust) return;
  const origin = formatOrigin(fiddle.origin);
  if (!prompt.interactive)
    throw new FiddleError(CliErrorCode.untrusted, t('errorUntrusted', { origin }));

  const td = tm('mainDocuments');
  const detail = trustDetail(fiddle.origin, Object.keys(fiddle.files), modules, td);
  const answer = await prompt.ask(
    `${td('trustMessage')}\n${detail}`,
    `${t('trustQuestion')} `,
  );
  if (!/^y(es)?$/i.test(answer.trim()))
    throw new FiddleError(CliErrorCode.untrusted, tm('mainRun')('untrusted'));
}
