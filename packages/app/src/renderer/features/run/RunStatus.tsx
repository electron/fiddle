import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { srOnly, StatusPill } from '../../../ui';
import { useAppState, useWindowState } from '../../state';
import { BisectControls, BisectDialogs } from '../bisect/Bisect';
import styles from './Run.module.css';
import { IDLE_RUN, STATUS_LABEL, versionLabel } from './use-run';

export function RunStatus() {
  const { t } = useTranslation('run');
  const win = useWindowState();
  const app = useAppState();
  const run = win?.run ?? IDLE_RUN;

  const errors = run.errors;

  // New console errors are announced once, politely.
  const [announcement, setAnnouncement] = useState('');
  const announced = useRef(0);
  useEffect(() => {
    if (errors.length < announced.current) announced.current = 0;
    const latest = errors[errors.length - 1];
    if (latest && errors.length > announced.current) {
      setAnnouncement(
        t('newError', { name: latest.name, file: latest.file, message: latest.message }),
      );
    }
    announced.current = errors.length;
  }, [errors, t]);

  const version = run.version ?? versionLabel(win?.fiddle.versionRef, app);
  const percent = run.version ? (app?.versions?.installs[run.version]?.percent ?? 0) : 0;

  return (
    <div className={styles.status}>
      {run.status === 'running' ? (
        <StatusPill className={styles.runningPill}>{t('running')}</StatusPill>
      ) : run.status === 'downloading' ? (
        <span>{t('downloadingPercent', { percent })}</span>
      ) : (
        <span>{t(STATUS_LABEL[run.status])}</span>
      )}
      {version && <span>{t('electronVersion', { version })}</span>}
      {app?.versions?.arch && <span>{app.versions.arch}</span>}
      <BisectControls run={run} />
      <BisectDialogs run={run} />
      <span aria-live="polite" className={srOnly}>
        {announcement}
      </span>
    </div>
  );
}
