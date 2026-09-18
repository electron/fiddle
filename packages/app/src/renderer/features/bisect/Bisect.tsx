/**
 * Bisect: the range dialog (opened by the `bisect.toggle` command),
 * Good / Bad / Skip / Cancel in the status bar while bisecting, and the result
 * with the GitHub comparison.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getDefaultBisectRange, compareVersions } from '../../../fiddle/versions';
import { runApi, windowApi } from '../../../ipc/renderer';
import type { RunState } from '../../../shared/stores';
import { visibleVersions } from '../../../main/versions/releases';
import { Button, Dialog, InlineCode, Select } from '../../../ui';
import styles from '../run/Run.module.css';
import { useAppState } from '../../state';
import { toastError } from '../../toast-error';
import { useReleases } from '../run/use-run';

/** Runs a bisect call and shows why it failed. */
const attempt = (promise: Promise<unknown>, failedTitle: string) =>
  promise.catch((error: unknown) => toastError(error, failedTitle));

export function BisectControls({ run }: { run: RunState }) {
  const { t } = useTranslation('run');
  const bisect = run.bisect;
  if (!bisect || bisect.result) return null;
  const call = (promise: Promise<unknown>) => attempt(promise, t('bisectFailed'));
  const { current, auto } = bisect;
  return (
    <span className={styles.bisect}>
      {current && t(auto ? 'bisectAutoRunning' : 'bisectTesting', { version: current })}
      {current && !auto && (
        <>
          <Button size="sm" variant="secondary" onPress={() => call(runApi.BisectGood())}>
            {t('bisectGood')}
          </Button>
          <Button size="sm" variant="secondary" onPress={() => call(runApi.BisectBad())}>
            {t('bisectBad')}
          </Button>
          <Button size="sm" variant="ghost" onPress={() => call(runApi.BisectSkip())}>
            {t('bisectSkip')}
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" onPress={() => call(runApi.StopBisect())}>
        {t('cancel')}
      </Button>
    </span>
  );
}

export function BisectDialogs({ run }: { run: RunState }) {
  const { t } = useTranslation('run');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      return windowApi.onCommand((id) => {
        if (id === 'bisect.toggle') setOpen(true);
      });
    } catch {
      return undefined;
    }
  }, []);
  const result = run.bisect?.result ?? null;
  const call = (promise: Promise<unknown>) => attempt(promise, t('bisectFailed'));

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
              <Button
                variant="primary"
                icon="external"
                onPress={() => call(runApi.OpenBisectCompare())}
              >
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
  const visible = app
    ? visibleVersions(rows, app.settings, (v) => installs[v]?.state === 'installed')
    : [];
  const defaults = getDefaultBisectRange(visible);
  const [good, setGood] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const goodValue = good ?? defaults?.good ?? null;
  const badValue = bad ?? defaults?.bad ?? null;
  const invalid =
    goodValue !== null && badValue !== null && compareVersions(goodValue, badValue) >= 0;
  const items = visible.map((version) => ({ id: version, label: version }));

  const start = (auto: boolean) => {
    if (!goodValue || !badValue || invalid) return;
    onClose();
    // The dialog is gone by the time main can refuse a range, so the failure is a toast.
    void attempt(runApi.StartBisect(goodValue, badValue, auto), t('bisectFailed'));
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
      <Select
        label={t('bisectGoodVersion')}
        placeholder={t('versionPicker')}
        items={items}
        value={goodValue}
        onChange={setGood}
      />
      <Select
        label={t('bisectBadVersion')}
        placeholder={t('versionPicker')}
        items={items}
        value={badValue}
        onChange={setBad}
        isInvalid={invalid}
        errorMessage={t('bisectRangeInvalid')}
      />
    </Dialog>
  );
}
