/**
 * "Reset privacy permissions", on macOS only. Fiddles run as Electron Fiddle, so the camera, microphone and other grants they got
 * are Electron Fiddle's. `tccutil reset All <bundle ID>` forgets them all,
 * after a confirmation.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { ErrorCode, FiddleError } from '../../shared/errors';
import { confirm } from '../dialogs';
import { tm } from '../i18n';
import { log } from '../log';

/** forge.config.ts `appBundleId`. */
export const BUNDLE_ID = 'com.electron.fiddle';
export const TCCUTIL = '/usr/bin/tccutil';

export function tccutilArgs(bundleId = BUNDLE_ID): string[] {
  return ['reset', 'All', bundleId];
}

/** Resolves false when the user cancels. */
export async function resetPrivacyPermissions(windowId: string): Promise<boolean> {
  if (process.platform !== 'darwin') {
    throw new FiddleError(
      ErrorCode.unavailable,
      'Privacy permissions can only be reset on macOS',
    );
  }
  const tp = tm('mainPlatform');
  const ok = await confirm(windowId, {
    type: 'warning',
    message: tp('resetPrivacyMessage'),
    detail: tp('resetPrivacyDetail'),
    ok: tp('resetPrivacyButton'),
  });
  if (!ok) return false;
  try {
    await promisify(execFile)(TCCUTIL, tccutilArgs());
  } catch (error) {
    log.error('tccutil failed', error);
    throw new FiddleError(ErrorCode.internal, tp('resetPrivacyFailed'));
  }
  return true;
}
