import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { windowApi } from '../../ipc/renderer';
import type { Platform } from '../../shared/stores';
import { ToolbarButton, ToolbarCapsule, Tooltip } from '../../ui';
import { OpenGistButton } from '../features/gists/OpenGistButton';
import { PublishButton } from '../features/gists/PublishButton';
import { RunButton } from '../features/run/RunButton';
import { VersionPicker } from '../features/versions/VersionPicker';
import styles from './Shell.module.css';

export interface TitleBarProps {
  name: string;
  dirty: boolean;
  platform: Platform;
  sidebar: boolean;
  settingsOpen: boolean;
  onToggleSidebar: () => void;
  onToggleSettings: () => void;
}

/** Controls in the title bar; a double-click on them isn't a title bar double-click. */
const CONTROLS = 'button, a, input, [role="button"], [role="toolbar"], [role="dialog"]';

/** 56px, on the material, a drag region. The capsule is centred in the window. */
export function TitleBar({
  name,
  dirty,
  platform,
  sidebar,
  settingsOpen,
  onToggleSidebar,
  onToggleSettings,
}: TitleBarProps) {
  const { t } = useTranslation('shell');
  const sidebarLabel = sidebar ? t('hideSidebar') : t('showSidebar');

  // macOS: empty title bar space minimizes or zooms, as the system preference says (§17.1).
  const onDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (platform !== 'darwin' || (event.target as Element).closest(CONTROLS)) return;
    windowApi.DoubleClickTitleBar().catch((error: unknown) => {
      console.error('[fiddle] title bar double-click failed', error);
    });
  };

  return (
    <header className={styles.titlebar} onDoubleClick={onDoubleClick}>
      <span className={styles.start}>
        <Tooltip label={sidebarLabel}>
          <ToolbarButton icon="sidebar" label={sidebarLabel} onPress={onToggleSidebar} />
        </Tooltip>
      </span>
      <div className={styles.title}>
        <span className={styles.name}>{name}</span>
        {dirty && <span className={styles.edited}>{t('edited')}</span>}
      </div>
      <ToolbarCapsule label={t('toolbar')} className={styles.capsule}>
        <VersionPicker />
        <RunButton />
      </ToolbarCapsule>
      <div className={styles.end}>
        <OpenGistButton />
        <PublishButton />
        <Tooltip label={t('settings')}>
          <ToolbarButton icon="settings" label={t('settings')} isPressed={settingsOpen} onPress={onToggleSettings} />
        </Tooltip>
      </div>
    </header>
  );
}
