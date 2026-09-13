/**
 * Run and Stop in the toolbar capsule (Lucent "Flows and states: Run"):
 * Ready, Downloading 42%, Starting and Running. The width never jumps: at
 * least 108px, 150px while downloading. State changes are announced.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { windowApi } from '../../../ipc/renderer';
import { Button, srOnly } from '../../../ui';
import { useAppState, useWindowState } from '../../state';
import styles from './Run.module.css';
import { IDLE_RUN, useRunKbd, versionLabel } from './use-run';

export function RunButton() {
  const { t } = useTranslation('run');
  const win = useWindowState();
  const app = useAppState();
  const kbd = useRunKbd();
  const run = win?.run ?? IDLE_RUN;
  // Pressing Run shows "Starting" at once, until main's next Window update.
  const [pendingRev, setPendingRev] = useState<number | null>(null);
  const pending = pendingRev !== null && pendingRev === win?.rev;

  const status = pending && run.status === 'ready' ? 'starting' : run.status;
  const version = run.version ?? versionLabel(win?.fiddle.versionRef, app) ?? '';
  const percent = Math.round(
    (run.version ? app?.versions?.installs[run.version]?.percent : undefined) ?? run.percent ?? 0,
  );

  const toggle = () => {
    if (status === 'ready') setPendingRev(win?.rev ?? null);
    windowApi.RunCommand('run.toggle').catch((error: unknown) => {
      setPendingRev(null);
      console.error('[fiddle] run failed', error);
    });
  };

  const announcement =
    status === 'running'
      ? t('announceRunning', { version })
      : status === 'starting'
        ? t('announceStarting')
        : status === 'downloading'
          ? t('announceDownloading', { version })
          : t('announceReady');

  // `data-tour` anchors the onboarding tour.
  return (
    <>
      {status === 'running' ? (
        <Button data-tour="run" variant="stop" icon="stop" kbd={kbd} onPress={toggle} className={styles.run}>
          {t('stop')}
        </Button>
      ) : status === 'downloading' ? (
        <Button data-tour="run" variant="primary" progress={percent} onPress={toggle} className={styles.downloading}>
          {t('downloadingPercent', { percent })}
        </Button>
      ) : status === 'starting' ? (
        <Button data-tour="run" variant="primary" loading isDisabled className={styles.run}>
          {t('starting')}
        </Button>
      ) : (
        <Button data-tour="run" variant="primary" icon="play" kbd={kbd} onPress={toggle} className={styles.run}>
          {t('run')}
        </Button>
      )}
      <span role="status" className={srOnly}>
        {announcement}
      </span>
    </>
  );
}
