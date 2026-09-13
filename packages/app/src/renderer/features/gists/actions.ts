/** Gist actions that end in a toast: update, delete, copy link, and error reporting. */
import type { TFunction } from 'i18next';

import { githubApi, settingsApi } from '../../../ipc/renderer';
import { ErrorCode, FiddleError } from '../../../shared/errors';
import { confirmDialog, showToast } from '../../../ui';
import { showGistDialog } from './state';

export type GistT = TFunction<'gists'>;
type GistAction = 'publish' | 'update' | 'delete';

const failedTitle = { publish: 'publishFailed', update: 'updateFailed', delete: 'deleteFailed' } as const;

function reasonOf(error: FiddleError): unknown {
  return (error.details as { reason?: unknown } | undefined)?.reason;
}

export function copyShareLink(t: GistT, id: string): void {
  githubApi.CopyShareLink(id).then(
    () => showToast({ tone: 'success', title: t('linkCopied') }),
    (error: unknown) => showToast({ tone: 'error', title: FiddleError.from(error).message }),
  );
}

export function setGistVisibility(isPublic: boolean): void {
  void settingsApi.SetSetting('gistVisibility', isPublic ? 'public' : 'secret');
}

export function showGistSaved(t: GistT, title: 'published' | 'updated', id: string): void {
  showToast({ tone: 'success', title: t(title), actionLabel: t('copyLink'), onAction: () => copyShareLink(t, id) });
}

/**
 * Signed out: sign in, then retry. Anything else: the error GitHub reported,
 * plus a hint about ownership (update and delete) or connectivity.
 */
export function reportGistError(t: GistT, action: GistAction, error: unknown, retry?: () => void): void {
  const e = FiddleError.from(error);
  if (e.code === ErrorCode.unauthorized && reasonOf(e) === 'signed-out' && retry) {
    showGistDialog({ kind: 'sign-in', then: retry });
    return;
  }
  const ownership =
    action !== 'publish' &&
    (e.code === ErrorCode.notFound || e.code === ErrorCode.forbidden || e.code === ErrorCode.unauthorized);
  const hint = ownership ? t('hintOwnership') : t('hintConnectivity');
  showToast(
    { tone: 'error', title: t(failedTitle[action]), description: t('errorWithHint', { error: e.message, hint }) },
    { timeout: 10_000 },
  );
}

export async function updateGist(t: GistT): Promise<void> {
  try {
    const link = await githubApi.Update();
    showGistSaved(t, 'updated', link.id);
  } catch (error) {
    reportGistError(t, 'update', error, () => void updateGist(t));
  }
}

export async function deleteGist(t: GistT): Promise<void> {
  const confirmed = await confirmDialog({
    title: t('deleteConfirmTitle'),
    message: t('deleteConfirmMessage'),
    confirmLabel: t('deleteConfirm'),
    cancelLabel: t('cancel'),
    tone: 'danger',
    icon: 'trash',
    iconTone: 'danger',
  });
  if (!confirmed) return;
  try {
    await githubApi.Delete();
    showToast({ tone: 'success', title: t('deleted') });
  } catch (error) {
    reportGistError(t, 'delete', error, () => void deleteGist(t));
  }
}
