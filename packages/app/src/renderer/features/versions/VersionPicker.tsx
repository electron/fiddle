/**
 * The Electron version select in the toolbar capsule (Lucent "Version
 * picker"): transparent inside the capsule, 180 wide. The menu opens 10px
 * below the capsule with local builds, "Stable" and "Pre-release" groups,
 * right-aligned hints and each version's install state. Disabled while
 * running or bisecting.
 */
import { useTranslation } from 'react-i18next';

import { versionsApi } from '../../../ipc/renderer';
import { visibleVersions } from '../../../main/versions/releases';
import type { VersionRefValue, VersionsState } from '../../../shared/stores';
import { Select, type IconName, type SelectGroup, type SelectOption } from '../../../ui';
import { useAppState, useWindowState } from '../../state';
import { IDLE_RUN, useReleases, versionLabel } from '../run/use-run';
import styles from './Versions.module.css';

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

export function VersionPicker() {
  const { t } = useTranslation('run');
  const win = useWindowState();
  const app = useAppState();
  const rows = useReleases();
  const run = win?.run ?? IDLE_RUN;
  const ref = win?.fiddle.versionRef;
  const installs = app?.versions?.installs ?? {};
  const keep = ref?.kind === 'release' ? [ref.version] : [];
  const visible = app
    ? visibleVersions(rows, app.settings, (v) => installs[v]?.state === 'installed', keep)
    : keep;
  const latest = rows.find((r) => r.supported && isStable(r.version))?.version;

  const option = (version: string): SelectOption => {
    const install = installs[version];
    const hint =
      install?.state === 'downloading'
        ? t('hintPercent', { percent: install.percent ?? 0 })
        : version === latest
          ? t('hintLatest')
          : version.includes('nightly')
            ? t('hintNightly')
            : isStable(version)
              ? undefined
              : t('hintBeta');
    return {
      id: `r:${version}`,
      label: t('electronVersion', { version }),
      icon: installIcon(install),
      ...(hint ? { hint } : {}),
    };
  };

  const local: SelectOption[] = (app?.versions?.localBuilds ?? []).map((build) => ({
    id: `l:${build.id}`,
    label: build.name,
    icon: 'folder',
    ...(build.available ? {} : { hint: t('hintMissing'), isDisabled: true }),
  }));
  const groups: SelectGroup[] = [
    { title: t('groupLocal'), options: local },
    { title: t('groupStable'), options: visible.filter(isStable).map(option) },
    { title: t('groupPrerelease'), options: visible.filter((v) => !isStable(v)).map(option) },
  ].filter((group) => group.options.length > 0);

  const bisecting = run.bisect !== null && run.bisect.result === null;
  const current = ref ? refId(ref) : null;
  // Until the release list loads, the current version isn't an option yet:
  // show its label rather than an empty trigger.
  const known = versionLabel(ref, app);
  const currentLabel = ref?.kind === 'release' && known ? t('electronVersion', { version: known }) : known;

  return (
    <Select
      data-tour="version-picker"
      aria-label={t('versionPicker')}
      placeholder={currentLabel || t('versionPicker')}
      items={groups}
      value={current}
      isDisabled={run.status !== 'ready' || bisecting}
      className={styles.picker}
      onChange={(id) => {
        const next = parseRefId(id);
        if (!next || id === current) return;
        versionsApi
          .SetVersion(next)
          .catch((error: unknown) => console.error('[fiddle] changing version failed', error));
      }}
    />
  );
}
