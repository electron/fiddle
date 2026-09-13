/**
 * The status bar's left side: "Ready" or the "Running" pill, then the Electron
 * version and processor. Also hosts the bisect controls and dialogs, and hands
 * runtime errors to the editor's error markers.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { RuntimeErrorValue } from '../../../shared/stores';
import { setRuntimeErrors, type RuntimeError } from '../../editor/runtime-errors';
import { useWindowState } from '../../shell/window-state';
import { BisectControls, BisectDialogs } from '../bisect/Bisect';
import styles from './Run.module.css';
import { IDLE_RUN, useAppState, versionLabel } from './use-run';

/** Main's runtime errors in the shape the editor markers use. */
export function toEditorErrors(errors: readonly RuntimeErrorValue[]): RuntimeError[] {
  return errors.map((error) => ({
    file: error.file,
    line: error.line,
    column: error.column ?? 1,
    message: error.message ? `${error.name}: ${error.message}` : error.name,
    process: error.process,
  }));
}

export function RunStatus() {
  const { t } = useTranslation('run');
  const win = useWindowState();
  const app = useAppState();
  const run = win?.run ?? IDLE_RUN;

  // Errors clear on the next run: main empties the list when a run starts.
  const errors = run.errors;
  useEffect(() => setRuntimeErrors(toEditorErrors(errors)), [errors]);

  // New console errors are announced once, politely.
  const [announcement, setAnnouncement] = useState('');
  const announced = useRef(0);
  useEffect(() => {
    if (errors.length < announced.current) announced.current = 0;
    const latest = errors[errors.length - 1];
    if (latest && errors.length > announced.current) {
      setAnnouncement(t('newError', { name: latest.name, file: latest.file, message: latest.message }));
    }
    announced.current = errors.length;
  }, [errors, t]);

  const version = run.version ?? versionLabel(win?.fiddle.versionRef, app);
  const percent = run.version ? (app?.versions?.installs[run.version]?.percent ?? 0) : 0;

  return (
    <div className={styles.status}>
      {run.status === 'running' ? (
        <span className={styles.runningPill}>
          <span className={styles.dot} aria-hidden="true" />
          {t('running')}
        </span>
      ) : run.status === 'downloading' ? (
        <span>{t('downloadingPercent', { percent })}</span>
      ) : run.status === 'starting' ? (
        <span>{t('starting')}</span>
      ) : (
        <span>{t('ready')}</span>
      )}
      {version && <span>{t('electronVersion', { version })}</span>}
      {app?.versions?.arch && <span>{app.versions.arch}</span>}
      <BisectControls run={run} />
      <BisectDialogs run={run} />
      <span aria-live="polite" className={styles.srOnly}>
        {announcement}
      </span>
    </div>
  );
}
