/**
 * Bisect (REQUIREMENTS §17.9): the range dialog (opened by the
 * `bisect.toggle` command), Good / Bad / Skip / Cancel in the status bar
 * while bisecting, and the result with the GitHub comparison.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getDefaultBisectRange, compareVersions } from '../../../fiddle/versions';
import { runApi } from '../../../ipc/renderer';
import type { RunState } from '../../../shared/stores';
import { visibleVersions } from '../../../main/versions/releases';
import { Button, Dialog, InlineCode, Select } from '../../../ui';
import styles from '../run/Run.module.css';
import { useAppState, useReleases } from '../run/use-run';

const call = (promise: Promise<unknown>) =>
  promise.catch((error: unknown) => console.error('[fiddle] bisect failed', error));

/** Shown in the status bar while a bisect is in progress. */
export function BisectControls({ run }: { run: RunState }) {
  const { t } = useTranslation('run');
  const bisect = run.bisect;
  if (!bisect || bisect.result || !bisect.current) {
    return bisect && !bisect.result ? (
      <span className={styles.bisect}>
        <Button size="sm" variant="ghost" onPress={() => call(runApi.StopBisect())}>
          {t('cancel')}
        </Button>
      </span>
    ) : null;
  }
  if (bisect.auto) {
    return (
      <span className={styles.bisect}>
        {t('bisectAutoRunning', { version: bisect.current })}
        <Button size="sm" variant="ghost" onPress={() => call(runApi.StopBisect())}>
          {t('cancel')}
        </Button>
      </span>
    );
  }
  return (
    <span className={styles.bisect}>
      {t('bisectTesting', { version: bisect.current })}
      <Button size="sm" variant="secondary" onPress={() => call(runApi.BisectGood())}>
        {t('bisectGood')}
      </Button>
      <Button size="sm" variant="secondary" onPress={() => call(runApi.BisectBad())}>
        {t('bisectBad')}
      </Button>
      <Button size="sm" variant="ghost" onPress={() => call(runApi.BisectSkip())}>
        {t('bisectSkip')}
      </Button>
      <Button size="sm" variant="ghost" onPress={() => call(runApi.StopBisect())}>
        {t('cancel')}
      </Button>
    </span>
  );
}

/** The range dialog and the result dialog. */
export function BisectDialogs({ run }: { run: RunState }) {
  const { t } = useTranslation('run');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      return runApi.onShowBisect(() => setOpen(true));
    } catch {
      return undefined;
    }
  }, []);
  const result = run.bisect?.result ?? null;

  return (
    <>
      {open && <RangeDialog onClose={() => setOpen(false)} />}
      {result && (
        <Dialog
          title={t('bisectDoneTitle')}
          isOpen
          onOpenChange={(isOpen) => !isOpen && call(runApi.StopBisect())}
          footer={
            <>
              <Button variant="ghost" onPress={() => call(runApi.StopBisect())}>
                {t('close')}
              </Button>
              <Button variant="primary" icon="external" onPress={() => call(runApi.OpenBisectCompare())}>
                {t('openCompare')}
              </Button>
            </>
          }
        >
          <p>{t('bisectResult', { good: result.good, bad: result.bad })}</p>
          <InlineCode>{`https://github.com/electron/electron/compare/v${result.good}...v${result.bad}`}</InlineCode>
        </Dialog>
      )}
    </>
  );
}

function RangeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('run');
  const app = useAppState();
  const rows = useReleases();
  const installs = app?.versions?.installs ?? {};
  const visible = app ? visibleVersions(rows, app.settings, (v) => installs[v]?.state === 'installed') : [];
  const defaults = getDefaultBisectRange(visible);
  const [good, setGood] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const goodValue = good ?? defaults?.good ?? null;
  const badValue = bad ?? defaults?.bad ?? null;
  const invalid = goodValue !== null && badValue !== null && compareVersions(goodValue, badValue) >= 0;
  const items = visible.map((version) => ({ id: version, label: version }));

  const start = (auto: boolean) => {
    if (!goodValue || !badValue || invalid) return;
    onClose();
    call(runApi.StartBisect(goodValue, badValue, auto));
  };

  return (
    <Dialog
      title={t('bisectTitle')}
      description={t('bisectIntro')}
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="secondary" isDisabled={invalid} onPress={() => start(true)}>
            {t('bisectAuto')}
          </Button>
          <Button variant="primary" isDisabled={invalid} onPress={() => start(false)}>
            {t('bisectStart')}
          </Button>
        </>
      }
    >
      <Select label={t('bisectGoodVersion')} items={items} value={goodValue} onChange={setGood} />
      <Select
        label={t('bisectBadVersion')}
        items={items}
        value={badValue}
        onChange={setBad}
        isInvalid={invalid}
        errorMessage={t('bisectRangeInvalid')}
      />
    </Dialog>
  );
}
