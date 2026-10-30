import { useTranslation } from 'react-i18next';

import { getEditorLanguage } from '../../fiddle/files';
import { useEditorCursor } from '../editor/editor-state';
import { useTabFocusMode } from '../features/commands/window-commands';
import { RunStatus } from '../features/run/RunStatus';
import { NotificationsButton } from './NotificationsButton';
import styles from './Shell.module.css';

export function StatusBar({ files }: { files: readonly string[] }) {
  const { t } = useTranslation('shell');
  const tabFocus = useTabFocusMode();
  return (
    <footer className={styles.statusbar} aria-label={t('status')}>
      <RunStatus />
      <div className={styles.statusEnd}>
        {/* Tab-focus mode: a live region, so turning it on is announced. */}
        <span role="status">{tabFocus ? t('tabFocusMode') : ''}</span>
        <CursorPosition files={files} />
        <NotificationsButton />
      </div>
    </footer>
  );
}

/** On its own, so a keystroke re-renders these two spans and not the rest of the bar. */
function CursorPosition({ files }: { files: readonly string[] }) {
  const { t } = useTranslation('shell');
  const cursor = useEditorCursor();
  const current = cursor && files.includes(cursor.file) ? cursor : null;
  if (!current) return null;
  return (
    <>
      <span>{t('cursorPosition', { line: current.line, column: current.column })}</span>
      <span>{t(`language.${getEditorLanguage(current.file)}`)}</span>
    </>
  );
}
