import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { windowApi } from '../../../ipc/renderer';
import type { RunState } from '../../../shared/stores';
import { Button, srOnly } from '../../../ui';
import { useAppState, useWindowState } from '../../state';
import { toastError } from '../../toast-error';
import { useShortcut } from '../../use-shortcut';
import styles from './Run.module.css';
import { IDLE_RUN, STATUS_LABEL, versionLabel } from './use-run';

type Status = RunState['status'];

/** `compact`: the narrowest title bar (Windows) drops the key hint and the minimum width. */
export function RunButton({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useTranslation('run');
  const win = useWindowState();
  const app = useAppState();
  const shortcut = useShortcut('run.toggle');
  const kbd = compact ? undefined : shortcut;
  const runClass = compact ? styles.runCompact : styles.run;
  const run = win?.run ?? IDLE_RUN;
  // Pressing Run shows "Checking" at once, until main's next Window update.
  const [pendingRev, setPendingRev] = useState<number | null>(null);
  const pending = pendingRev !== null && pendingRev === win?.rev;

  const status: Status = pending && run.status === 'ready' ? 'checking' : run.status;
  const version = run.version ?? versionLabel(win?.fiddle.versionRef, app) ?? '';
  const percent = Math.round(
    (run.version ? app?.versions?.installs[run.version]?.percent : undefined) ?? 0,
  );

  const toggle = () => {
    if (status === 'ready') setPendingRev(win?.rev ?? null);
    windowApi.RunCommand('run.toggle').catch((error: unknown) => {
      setPendingRev(null);
      toastError(error);
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

  const idle = status === 'ready' || status === 'running';
  const busy = !idle && status !== 'downloading';
  const wide = status === 'downloading' || status === 'installing';

  return (
    <>
      <Button
        data-tour="run"
        variant={status === 'running' ? 'stop' : 'primary'}
        icon={status === 'running' ? 'stop' : status === 'ready' ? 'play' : undefined}
        kbd={idle ? kbd : undefined}
        progress={status === 'downloading' ? percent : undefined}
        loading={busy}
        isDisabled={busy}
        onPress={busy ? undefined : toggle}
        className={wide && !compact ? styles.wide : runClass}
      >
        {status === 'running'
          ? t('stop')
          : status === 'downloading'
            ? t('downloadingPercent', { percent })
            : status === 'ready'
              ? t('run')
              : t(STATUS_LABEL[status])}
      </Button>
      <span role="status" className={srOnly}>
        {announcement[status]}
      </span>
    </>
  );
}
