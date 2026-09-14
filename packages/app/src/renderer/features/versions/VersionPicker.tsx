/**
 * The Electron version picker in the toolbar capsule (Lucent "Version
 * picker", §17.8): transparent inside the capsule, 180 wide. Its menu opens
 * 10px below the capsule with a search field, then local builds and the
 * "Stable" and "Pre-release" groups, each newest first; a search drops the
 * groups for one newest-first list. Each row shows its install state, the
 * design's hints ("latest", "beta") sit on the right, and versions this
 * computer can't run are disabled. "Copy version number" ends the menu.
 * Disabled while running or bisecting.
 *
 * It also shows the window's version notices (fallbacks and failed
 * downloads) as toasts, and retries the version's download when the
 * computer comes back online.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { versionsApi } from '../../../ipc/renderer';
import { pickerGroups, type PickerEntry, type PickerGroup } from '../../../main/versions/releases';
import type { VersionNotice, VersionRefValue, VersionsState } from '../../../shared/stores';
import { showToast, type IconName } from '../../../ui';
import { useAppState, useWindowState } from '../../state';
import { IDLE_RUN, useReleases, versionLabel } from '../run/use-run';
import { SearchSelect, type SearchGroup, type SearchOption } from './SearchSelect';
import styles from './Versions.module.css';

const COPY = 'action:copy';

const GROUP_TITLES = {
  local: 'groupLocal',
  stable: 'groupStable',
  prerelease: 'groupPrerelease',
  results: undefined,
} as const satisfies Record<PickerGroup['key'], string | undefined>;

const HINTS = { latest: 'hintLatest', beta: 'hintBeta', nightly: 'hintNightly' } as const;

export function refId(ref: VersionRefValue): string {
  return ref.kind === 'release' ? `r:${ref.version}` : `l:${ref.id}`;
}

export function parseRefId(id: string): VersionRefValue | undefined {
  if (id.startsWith('r:')) return { kind: 'release', version: id.slice(2) };
  if (id.startsWith('l:')) return { kind: 'local', id: id.slice(2) };
  return undefined;
}

export const isStable = (version: string) => !version.includes('-');

export function installIcon(install: VersionsState['installs'][string] | undefined): IconName {
  return install?.state === 'installed' ? 'success' : 'cloud';
}

const shownNotices = new Set<number>();

/** Shows the window's version notice once as an error toast, then clears it in main. */
function useVersionNotice(notice: VersionNotice | null | undefined) {
  useEffect(() => {
    if (!notice || shownNotices.has(notice.id)) return;
    shownNotices.add(notice.id);
    showToast({ tone: 'error', title: notice.message });
    versionsApi.DismissNotice(notice.id).catch(() => undefined);
  }, [notice]);
}

/** Back online: download the window's version if it still isn't (§17.8). */
function useRetryWhenOnline() {
  useEffect(() => {
    const retry = () => {
      versionsApi
        .RetryDownload()
        .catch((error: unknown) => console.error('[fiddle] retrying the download failed', error));
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);
}

export function VersionPicker() {
  const { t } = useTranslation('run');
  const { t: tv } = useTranslation('versions');
  const win = useWindowState();
  const app = useAppState();
  const rows = useReleases();
  const [query, setQuery] = useState('');
  useVersionNotice(win?.versionNotice);
  useRetryWhenOnline();

  const run = win?.run ?? IDLE_RUN;
  const ref = win?.fiddle.versionRef;
  const settings = app?.settings;
  const versions = app?.versions;
  const groups = useMemo(
    () =>
      settings
        ? pickerGroups({
            rows,
            settings,
            installs: versions?.installs ?? {},
            localBuilds: versions?.localBuilds ?? [],
            current: ref,
            query,
          })
        : [],
    [rows, settings, versions, ref, query],
  );

  const stateText = (entry: PickerEntry): string => {
    switch (entry.state) {
      case 'installed':
        return t('stateInstalled');
      case 'downloaded':
        return t('stateDownloaded');
      case 'downloading':
        return t('stateDownloading', { percent: entry.percent ?? 0 });
      case 'installing':
        return t('stateInstalling');
      case 'unsupported':
        return t('stateUnsupported');
      case 'local':
        return t('stateLocal');
      case 'localMissing':
        return t('stateLocalMissing');
      default:
        return t('stateMissing');
    }
  };

  const option = (entry: PickerEntry): SearchOption => ({
    id: entry.id,
    label: entry.kind === 'release' ? t('electronVersion', { version: entry.label }) : entry.label,
    ...(entry.kind === 'local' ? { icon: 'folder' as const } : {}),
    detail: stateText(entry),
    ...(entry.hint ? { hint: t(HINTS[entry.hint]) } : {}),
    isDisabled: entry.disabled,
  });
  const searchGroups: SearchGroup[] = groups.map((group) => {
    const title = GROUP_TITLES[group.key];
    return { ...(title ? { title: t(title) } : {}), options: group.entries.map(option) };
  });

  const bisecting = run.bisect !== null && run.bisect.result === null;
  const current = ref ? refId(ref) : null;
  // Until the release list loads, the current version isn't an option yet:
  // show its label rather than an empty trigger.
  const known = versionLabel(ref, app);
  const currentLabel = ref?.kind === 'release' && known ? t('electronVersion', { version: known }) : known;

  const copy = () => {
    versionsApi.CopyVersion().then(
      () => showToast({ tone: 'success', title: tv('copied', { version: known ?? '' }) }),
      (error: unknown) => console.error('[fiddle] copying the version failed', error),
    );
  };

  return (
    <SearchSelect
      data-tour="version-picker"
      aria-label={t('versionPicker')}
      placeholder={currentLabel || t('versionPicker')}
      groups={searchGroups}
      value={current}
      query={query}
      onQueryChange={setQuery}
      searchLabel={tv('searchVersions')}
      emptyLabel={tv('noMatches')}
      actions={[{ id: COPY, label: tv('copyVersion'), icon: 'copy' }]}
      onAction={copy}
      isDisabled={run.status !== 'ready' || bisecting}
      className={styles.picker}
      onChange={(id) => {
        const next = parseRefId(id);
        if (!next || id === current) return;
        versionsApi
          .SetVersion(next)
          .catch((error: unknown) =>
            showToast({ tone: 'error', title: error instanceof Error ? error.message : String(error) }),
          );
      }}
    />
  );
}
