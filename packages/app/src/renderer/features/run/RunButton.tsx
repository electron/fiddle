/**
 * Run and Stop in the toolbar capsule (Lucent "Flows and states: Run",
 * REQUIREMENTS §17.6): Ready, Checking, Downloading 42%, Unzipping,
 * Installing modules, Starting and Running. The width never jumps: at least
 * 108px, and one wider size for the long labels (downloading, installing
 * modules). Busy states show a spinner, and every state is announced.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { windowApi } from '../../../ipc/renderer';
import type { RunState } from '../../../shared/stores';
import { Button, srOnly } from '../../../ui';
import { useAppState, useWindowState } from '../../state';
import styles from './Run.module.css';
import { IDLE_RUN, useRunKbd, versionLabel } from './use-run';

type Status = RunState['status'];

/** Button labels for the states that show a spinner. */
const BUSY_LABEL = {
  checking: 'checking',
  unzipping: 'unzipping',
  installing: 'installingModules',
  starting: 'starting',
} as const satisfies Partial<Record<Status, string>>;

export function RunButton() {
  const { t } = useTranslation('run');
  const win = useWindowState();
  const app = useAppState();
  const kbd = useRunKbd();
  const run = win?.run ?? IDLE_RUN;
  // Pressing Run shows "Checking" at once, until main's next Window update.
  const [pendingRev, setPendingRev] = useState<number | null>(null);
  const pending = pendingRev !== null && pendingRev === win?.rev;

  const status: Status = pending && run.status === 'ready' ? 'checking' : run.status;
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

  const announcement: Record<Status, string> = {
    ready: t('announceReady'),
    checking: t('announceChecking'),
    downloading: t('announceDownloading', { version }),
    unzipping: t('announceUnzipping', { version }),
    installing: t('announceInstalling'),
    starting: t('announceStarting'),
    running: t('announceRunning', { version }),
  };

  // `data-tour` anchors the onboarding tour.
  return (
    <>
      {status === 'running' ? (
        <Button data-tour="run" variant="stop" icon="stop" kbd={kbd} onPress={toggle} className={styles.run}>
          {t('stop')}
        </Button>
      ) : status === 'downloading' ? (
        <Button data-tour="run" variant="primary" progress={percent} onPress={toggle} className={styles.wide}>
          {t('downloadingPercent', { percent })}
        </Button>
      ) : status === 'ready' ? (
        <Button data-tour="run" variant="primary" icon="play" kbd={kbd} onPress={toggle} className={styles.run}>
          {t('run')}
        </Button>
      ) : (
        <Button
          data-tour="run"
          variant="primary"
          loading
          isDisabled
          className={status === 'installing' ? styles.wide : styles.run}
        >
          {t(BUSY_LABEL[status])}
        </Button>
      )}
      <span role="status" className={srOnly}>
        {announcement[status]}
      </span>
    </>
  );
}
