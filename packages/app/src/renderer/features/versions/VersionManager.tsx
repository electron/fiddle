/**
 * The version manager, for the Settings page's Electron section (Lucent
 * "VersionManager"): a filter, channel and "downloaded only" checkboxes, bulk
 * actions, and a table of local builds and releases with status and action.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getReleaseChannel, type ReleaseChannel } from '../../../fiddle/versions';
import { versionsApi } from '../../../ipc/renderer';
import type { LocalBuild, ReleaseRow, VersionsState } from '../../../shared/stores';
import {
  Button,
  Checkbox,
  confirmDialog,
  Icon,
  ProgressRing,
  showToast,
  Spinner,
  Table,
  TextField,
  type TableColumn,
  type TableSection,
} from '../../../ui';
import { useAppState } from '../../state';
import { useReleases } from '../run/use-run';
import styles from './Versions.module.css';

const ROW_LIMIT = 200;
const CHANNELS: readonly ReleaseChannel[] = ['stable', 'beta', 'nightly'];

type Row =
  | { id: string; kind: 'release'; release: ReleaseRow }
  | { id: string; kind: 'local'; build: LocalBuild };

const report = (promise: Promise<unknown>) =>
  promise.catch((error: unknown) =>
    showToast({ tone: 'error', title: error instanceof Error ? error.message : String(error) }),
  );

export function VersionManager() {
  const { t } = useTranslation('run');
  const app = useAppState();
  const rows = useReleases();
  const [query, setQuery] = useState('');
  const [channels, setChannels] = useState<readonly ReleaseChannel[]>(() => app?.settings.channels ?? ['stable', 'beta']);
  const [downloadedOnly, setDownloadedOnly] = useState(false);
  const installs: VersionsState['installs'] = app?.versions?.installs ?? {};
  const builds = app?.versions?.localBuilds ?? [];
  const downloadingAll = app?.versions?.downloadingAll ?? false;

  const needle = query.trim().toLowerCase();
  const matches = rows.filter(
    (row) =>
      channels.includes(getReleaseChannel(row.version)) &&
      (!downloadedOnly || installs[row.version] !== undefined) &&
      (!needle || row.version.includes(needle)),
  );
  const shown = matches.slice(0, ROW_LIMIT);
  const localRows = builds.filter((b) => !needle || b.name.toLowerCase().includes(needle));

  const tableRows: Array<Row | TableSection> = [];
  if (localRows.length > 0) {
    tableRows.push({ section: t('groupLocal') });
    for (const build of localRows) tableRows.push({ id: `l:${build.id}`, kind: 'local', build });
  }
  for (const channel of CHANNELS) {
    const inChannel = shown.filter((row) => getReleaseChannel(row.version) === channel);
    if (inChannel.length === 0) continue;
    tableRows.push({ section: t(channel === 'stable' ? 'channelStable' : channel === 'beta' ? 'channelBeta' : 'channelNightly') });
    for (const release of inChannel) tableRows.push({ id: `r:${release.version}`, kind: 'release', release });
  }

  const status = (row: Row) => {
    if (row.kind === 'local') {
      return row.build.available ? (
        <span className={styles.state}>
          <Icon name="folder" className={styles.muted} />
          {t('stateLocal')}
        </span>
      ) : (
        <span className={styles.state}>
          <Icon name="warning" className={styles.muted} />
          {t('stateLocalMissing')}
        </span>
      );
    }
    const install = installs[row.release.version];
    if (!row.release.supported) return <span className={styles.muted}>{t('stateUnsupported')}</span>;
    switch (install?.state) {
      case 'installed':
        return (
          <span className={styles.state}>
            <Icon name="success" className={styles.installed} />
            {t('stateInstalled')}
          </span>
        );
      case 'downloading':
        return (
          <span className={styles.state}>
            <ProgressRing value={install.percent ?? 0} />
            {t('stateDownloading', { percent: install.percent ?? 0 })}
          </span>
        );
      case 'installing':
        return (
          <span className={styles.state}>
            <Spinner />
            {t('stateInstalling')}
          </span>
        );
      case 'downloaded':
        return <span className={styles.state}>{t('stateDownloaded')}</span>;
      default:
        return (
          <span className={styles.state}>
            <Icon name="cloud" className={styles.muted} />
            {t('stateMissing')}
          </span>
        );
    }
  };

  const action = (row: Row) => {
    if (row.kind === 'local') {
      return (
        <Button size="sm" variant="ghost" icon="trash" onPress={() => report(versionsApi.RemoveLocalBuild(row.build.id))}>
          {t('remove')}
        </Button>
      );
    }
    const { version, supported } = row.release;
    const state = installs[version]?.state;
    if (state === 'installed' || state === 'downloaded') {
      return (
        <Button size="sm" variant="ghost" icon="trash" onPress={() => report(versionsApi.Remove(version))}>
          {t('remove')}
        </Button>
      );
    }
    if (state === undefined && supported) {
      return (
        <Button size="sm" variant="ghost" icon="download" onPress={() => report(versionsApi.Download(version))}>
          {t('download')}
        </Button>
      );
    }
    return null;
  };

  const columns: TableColumn<Row>[] = [
    {
      key: 'version',
      label: t('columnVersion'),
      mono: true,
      render: (row) => (row.kind === 'local' ? row.build.name : row.release.version),
    },
    { key: 'status', label: t('columnStatus'), render: status },
    { key: 'action', label: t('columnAction'), align: 'right', width: '140px', render: action },
  ];

  const toggleChannel = (channel: ReleaseChannel, on: boolean) =>
    setChannels((prev) => (on ? [...prev, channel] : prev.filter((c) => c !== channel)));

  const deleteAll = async () => {
    const ok = await confirmDialog({
      title: t('deleteAllTitle'),
      message: t('deleteAllBody'),
      confirmLabel: t('deleteAll'),
      cancelLabel: t('cancel'),
      tone: 'danger',
    });
    if (ok) await report(versionsApi.DeleteAll());
  };

  return (
    <div className={styles.manager}>
      <div className={styles.toolbar}>
        <TextField
          size="sm"
          icon="search"
          aria-label={t('filterVersions')}
          placeholder={t('filterVersions')}
          value={query}
          onChange={setQuery}
          className={styles.filter}
        />
        {CHANNELS.map((channel) => (
          <Checkbox key={channel} isSelected={channels.includes(channel)} onChange={(on) => toggleChannel(channel, on)}>
            {t(channel === 'stable' ? 'channelStable' : channel === 'beta' ? 'channelBeta' : 'channelNightly')}
          </Checkbox>
        ))}
        <Checkbox isSelected={downloadedOnly} onChange={setDownloadedOnly}>
          {t('downloadedOnly')}
        </Checkbox>
        <span className={styles.spacer} />
        <Button size="sm" variant="ghost" icon="refresh" onPress={() => report(versionsApi.RefreshReleases())}>
          {t('refreshReleases')}
        </Button>
        <Button size="sm" variant="secondary" icon="folder" onPress={() => report(versionsApi.AddLocalBuild())}>
          {t('addLocalBuild')}
        </Button>
        {downloadingAll ? (
          <Button size="sm" variant="secondary" icon="stop" onPress={() => report(versionsApi.StopDownloadAll())}>
            {t('stopDownloads')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onPress={() =>
              report(versionsApi.DownloadAll(matches.filter((r) => r.supported).map((r) => r.version)))
            }
          >
            {t('downloadAll')}
          </Button>
        )}
        <Button size="sm" variant="danger" icon="trash" onPress={() => void deleteAll()}>
          {t('deleteAll')}
        </Button>
      </div>
      <Table<Row> aria-label={t('columnVersion')} columns={columns} rows={tableRows} emptyMessage={t('noVersions')} />
      {matches.length > shown.length && (
        <p className={styles.note}>{t('truncated', { shown: shown.length, total: matches.length })}</p>
      )}
    </div>
  );
}
