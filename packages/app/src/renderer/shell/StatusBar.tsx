import { useTranslation } from 'react-i18next';

import { getEditorLanguage, type EditorLanguage } from '../../fiddle/files';
import { useEditorViewState } from '../editor/editor-state';
import { RunStatus } from '../features/run/RunStatus';
import styles from './Shell.module.css';

const languageKey = {
  javascript: 'languageJavascript',
  html: 'languageHtml',
  css: 'languageCss',
  json: 'languageJson',
} as const satisfies Record<EditorLanguage, string>;

/** 32px, on the material: run status on the left, the cursor and language on the right. */
export function StatusBar({ files }: { files: readonly string[] }) {
  const { t } = useTranslation('shell');
  const { cursor } = useEditorViewState();
  const current = cursor && files.includes(cursor.file) ? cursor : null;
  return (
    <footer className={styles.statusbar} aria-label={t('status')}>
      <RunStatus />
      {current && (
        <div className={styles.statusEnd}>
          <span>{t('cursorPosition', { line: current.line, column: current.column })}</span>
          <span>{t(languageKey[getEditorLanguage(current.file)])}</span>
        </div>
      )}
    </footer>
  );
}
