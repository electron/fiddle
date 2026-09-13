/**
 * The CLI's trust check (REQUIREMENTS §4 "Trust model"). run, bisect, package
 * and make execute a fiddle's code, so a remote fiddle (a gist, or
 * `electron:<tag>/<path>`) needs --trust, or a "y" at a terminal prompt that
 * shows its origin, files and dependencies. With neither, and no terminal to
 * ask in, it fails closed with `untrusted` before anything is written, installed
 * or run. No Electron imports.
 */
import type { FileMap } from '../../fiddle/files';
import { formatOrigin, isUntrustedOrigin, type FiddleOrigin } from '../../fiddle/trust';
import { FiddleError } from '../../shared/errors';
import { tm } from '../i18n';
import { t } from './argv';
import { CliErrorCode } from './output';

export interface TrustPrompt {
  /** False when stdin isn't a terminal, so nobody can answer. */
  readonly interactive: boolean;
  /** Shows `detail`, asks `question`, and resolves with the answer. */
  ask(detail: string, question: string): Promise<string>;
}

export async function ensureTrusted(
  fiddle: { origin: FiddleOrigin; files: FileMap },
  modules: Readonly<Record<string, string>>,
  trust: boolean,
  prompt: TrustPrompt,
): Promise<void> {
  if (!isUntrustedOrigin(fiddle.origin) || trust) return;
  const origin = formatOrigin(fiddle.origin);
  if (!prompt.interactive) throw new FiddleError(CliErrorCode.untrusted, t('errorUntrusted', { origin }));

  const td = tm('mainDocuments');
  const list = (items: string[]) => (items.length > 0 ? items.join(', ') : td('none'));
  const dependencies = Object.entries(modules).map(([name, spec]) => `${name}@${spec}`);
  const detail = [
    td('trustMessage'),
    td('trustDetail'),
    '',
    td('detailOrigin', { origin }),
    td('detailFiles', { files: list(Object.keys(fiddle.files)) }),
    td('detailDependencies', { dependencies: list(dependencies) }),
  ].join('\n');
  const answer = await prompt.ask(detail, t('trustQuestion'));
  if (!/^y(es)?$/i.test(answer.trim())) throw new FiddleError(CliErrorCode.untrusted, tm('mainRun')('untrusted'));
}
