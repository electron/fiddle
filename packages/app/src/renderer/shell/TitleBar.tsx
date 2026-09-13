import { useTranslation } from 'react-i18next';

import { ToolbarButton, ToolbarCapsule, Tooltip } from '../../ui';
import { PublishButton } from '../features/gists/PublishButton';
import { RunButton } from '../features/run/RunButton';
import { VersionPicker } from '../features/versions/VersionPicker';
import styles from './Shell.module.css';

export interface TitleBarProps {
  name: string;
  dirty: boolean;
  sidebar: boolean;
  settingsOpen: boolean;
  onToggleSidebar: () => void;
  onToggleSettings: () => void;
}

/** 56px, on the material, a drag region. The capsule is centred in the window. */
export function TitleBar({ name, dirty, sidebar, settingsOpen, onToggleSidebar, onToggleSettings }: TitleBarProps) {
  const { t } = useTranslation('shell');
  const sidebarLabel = sidebar ? t('hideSidebar') : t('showSidebar');
  return (
    <header className={styles.titlebar}>
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
        <PublishButton />
        <Tooltip label={t('settings')}>
          <ToolbarButton icon="settings" label={t('settings')} isPressed={settingsOpen} onPress={onToggleSettings} />
        </Tooltip>
      </div>
    </header>
  );
}
