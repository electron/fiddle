import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { versionsApi } from '../../../ipc/renderer';
import {
  pickerGroups,
  type PickerEntry,
  type PickerGroup,
  type VersionFilterSettings,
} from '../../../main/versions/releases';
import type {
  VersionNotice,
  VersionRefValue,
  VersionsState,
} from '../../../shared/stores';
import { cx, showToast } from '../../../ui';
import { setVersionRef } from '../../shell/window-state';
import { useAppState, useWindowState } from '../../state';
import { toastError } from '../../toast-error';
import { IDLE_RUN, useReleases, versionLabel } from '../run/use-run';
import { SearchSelect, type SearchGroup, type SearchOption } from './SearchSelect';
import styles from './Versions.module.css';

type RunT = TFunction<'run'>;
type Installs = VersionsState['installs'];

const COPY = 'action:copy';
const NO_INSTALLS: Installs = {};

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

/**
 * Every store push replaces every object, and a download pushes ten times a second:
 * this keeps a value's identity until its content changes.
 */
function useStableJson<T>(value: T): T {
  const json = JSON.stringify(value);
  return useMemo(() => JSON.parse(json) as T, [json]);
}

/** Install states without download percentages: what the list's shape depends on. */
function installStates(installs: Installs): Installs {
  return Object.fromEntries(
    Object.entries(installs).map(([version, install]) => [
      version,
      { state: install.state },
    ]),
  );
}

/** "Downloading 42%" by option id, for the versions downloading now. */
function downloadDetails(t: RunT, installs: Installs): Record<string, string> {
  const details: Record<string, string> = {};
  for (const [version, install] of Object.entries(installs)) {
    if (install.state === 'downloading') {
      details[refId({ kind: 'release', version })] = t('stateDownloading', {
        percent: install.percent ?? 0,
      });
    }
  }
  return details;
}

function stateText(t: RunT, entry: PickerEntry): string {
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
}

function toOption(t: RunT, entry: PickerEntry): SearchOption {
  return {
    id: entry.id,
    label:
      entry.kind === 'release'
        ? t('electronVersion', { version: entry.label })
        : entry.label,
    ...(entry.kind === 'local' ? { icon: 'folder' as const } : {}),
    detail: stateText(t, entry),
    ...(entry.hint ? { hint: t(HINTS[entry.hint]) } : {}),
    isDisabled: entry.disabled,
  };
}

function toSearchGroups(t: RunT, groups: PickerGroup[]): SearchGroup[] {
  return groups.map((group) => {
    const title = GROUP_TITLES[group.key];
    return {
      ...(title ? { title: t(title) } : {}),
      options: group.entries.map((entry) => toOption(t, entry)),
    };
  });
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

/** Back online: download the window's version if it still isn't. */
function useRetryWhenOnline() {
  useEffect(() => {
    const retry = () => {
      versionsApi.RetryDownload().catch((error: unknown) => toastError(error));
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);
}

/** `className` joins the picker's own: the title bar lets it narrow when the window does. */
export function VersionPicker({ className }: { className?: string } = {}) {
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
  const installs = app?.versions?.installs ?? NO_INSTALLS;

  const filter = useStableJson<VersionFilterSettings | null>(
    settings
      ? {
          channels: settings.channels,
          showObsolete: settings.showObsolete,
          showNotDownloaded: settings.showNotDownloaded,
        }
      : null,
  );
  const states = useStableJson(installStates(installs));
  const localBuilds = useStableJson(app?.versions?.localBuilds ?? []);
  const current = useStableJson(ref ?? null);
  const groups = useMemo(
    () =>
      filter
        ? toSearchGroups(
            t,
            pickerGroups({
              rows,
              settings: filter,
              installs: states,
              localBuilds,
              current: current ?? undefined,
              query,
            }),
          )
        : [],
    [t, rows, filter, states, localBuilds, current, query],
  );
  const details = useStableJson(downloadDetails(t, installs));
  const actions = useMemo(
    (): SearchOption[] => [{ id: COPY, label: tv('copyVersion'), icon: 'copy' }],
    [tv],
  );

  const bisecting = run.bisect !== null && run.bisect.result === null;
  const currentId = ref ? refId(ref) : null;
  // Until the release list loads, the current version isn't an option yet:
  // show its label rather than an empty trigger.
  const known = versionLabel(ref, app);
  const currentLabel =
    ref?.kind === 'release' && known ? t('electronVersion', { version: known }) : known;

  const copy = useCallback(() => {
    versionsApi.CopyVersion().then(
      () => showToast({ tone: 'success', title: tv('copied', { version: known ?? '' }) }),
      (error: unknown) => toastError(error),
    );
  }, [tv, known]);
  const setVersion = useCallback(
    (id: string) => {
      const next = parseRefId(id);
      if (!next || id === currentId) return;
      void setVersionRef(next, tv('versionChangeFailed'));
    },
    [currentId, tv],
  );

  return (
    <SearchSelect
      data-tour="version-picker"
      aria-label={t('versionPicker')}
      placeholder={currentLabel || t('versionPicker')}
      groups={groups}
      value={currentId}
      onChange={setVersion}
      query={query}
      onQueryChange={setQuery}
      searchLabel={tv('searchVersions')}
      emptyLabel={tv('noMatches')}
      actions={actions}
      onAction={copy}
      details={details}
      isDisabled={run.status !== 'ready' || bisecting}
      className={cx(styles.picker, className)}
    />
  );
}
