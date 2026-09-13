/**
 * The sheet: the tab row, one Monaco pane (or two when split), the console
 * and, when `Window.view` is `settings`, the settings page instead.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Platform, WindowState } from '../../shared/stores';
import { Button, EmptyState, Icon, IconButton, SplitHandle, Tab, TabList, Tabs, Tooltip } from '../../ui';
import { EditorPane } from '../editor/EditorPane';
import { countByFile, useRuntimeErrors } from '../editor/runtime-errors';
import { ConsolePane } from '../features/run/ConsolePane';
import { SettingsPage } from '../features/settings/SettingsPage';
import { processOf, type FileProcess } from './processes';
import styles from './Sheet.module.css';
import { useDraft } from './use-draft';

const CONSOLE_MIN = 96;

export const processLabelKey = {
  main: 'processMain',
  preload: 'processPreload',
  renderer: 'processRenderer',
} as const satisfies Record<FileProcess, string>;

export interface SheetProps {
  state: WindowState;
  platform: Platform;
  consoleVisible: boolean;
  onSelectFile: (name: string) => void;
  onToggleSplit: () => void;
  onCloseLeft: () => void;
  onCloseRight: () => void;
  onMaximize: (name: string) => void;
  onConsoleHeight: (height: number) => void;
  onResetLayout: () => void;
  /** Something droppable is being dragged over the window. */
  dropping: boolean;
}

export function Sheet(props: SheetProps) {
  const { t } = useTranslation('shell');
  const { state } = props;
  const sheet = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const node = sheet.current;
    if (!node) return;
    setHeight(node.clientHeight);
    const observer = new ResizeObserver(([entry]) => setHeight(entry?.contentRect.height ?? 0));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sheet} className={styles.sheet}>
      {state.view === 'settings' ? (
        <div className={styles.settings}>
          <SettingsPage />
        </div>
      ) : (
        <EditorArea {...props} sheetHeight={height} />
      )}
      {props.dropping && (
        <div className={styles.drop} aria-live="polite">
          <EmptyState icon="download" title={t('dropToOpen')}>
            {t('dropToOpenHint')}
          </EmptyState>
        </div>
      )}
    </section>
  );
}

function EditorArea({
  state,
  platform,
  consoleVisible,
  onSelectFile,
  onToggleSplit,
  onCloseLeft,
  onCloseRight,
  onMaximize,
  onConsoleHeight,
  onResetLayout,
  sheetHeight,
}: SheetProps & { sheetHeight: number }) {
  const { t } = useTranslation('shell');
  const { fiddle, layout } = state;
  const errors = countByFile(useRuntimeErrors());
  const visible = fiddle.files.filter((file) => file.visible);
  const names = fiddle.files.map((file) => file.name);
  const active =
    fiddle.activeFile && visible.some((file) => file.name === fiddle.activeFile)
      ? fiddle.activeFile
      : (visible[0]?.name ?? null);
  const split = layout.split && names.includes(layout.split) ? layout.split : null;
  const consoleMax = Math.max(CONSOLE_MIN, Math.floor(sheetHeight / 2));
  const [consoleHeight, setConsoleHeight] = useDraft(layout.consoleHeight, onConsoleHeight);
  const shownConsoleHeight = Math.min(Math.max(consoleHeight, CONSOLE_MIN), consoleMax);
  const splitKbd = platform === 'darwin' ? '⌘\\' : 'Ctrl+\\';
  const errorLabel = (name: string) => {
    const count = errors.get(name) ?? 0;
    return count ? t('errorCount', { count }) : undefined;
  };

  const consoleArea = consoleVisible && (
    <>
      <SplitHandle
        orientation="horizontal"
        value={shownConsoleHeight}
        min={CONSOLE_MIN}
        max={consoleMax}
        reverse
        onChange={setConsoleHeight}
        onReset={() => setConsoleHeight(160)}
        label={t('resizeConsole')}
      />
      <div className={styles.console} style={{ height: shownConsoleHeight }}>
        <ConsolePane />
      </div>
    </>
  );

  if (!active) {
    return (
      <>
        <div className={styles.empty}>
          <EmptyState
            icon="code"
            title={t('emptyTitle')}
            action={
              <Button variant="secondary" size="sm" icon="refresh" onPress={onResetLayout}>
                {t('resetLayout')}
              </Button>
            }
          >
            {t('emptyText')}
          </EmptyState>
        </div>
        {consoleArea}
      </>
    );
  }

  return (
    <>
      <div className={styles.tabrow}>
        <div className={styles.tabs}>
          <Tabs value={active} onChange={onSelectFile}>
            <TabList aria-label={t('openFiles')}>
              {visible.map((file) => (
                <Tab
                  key={file.name}
                  id={file.name}
                  errorCount={errors.get(file.name)}
                  errorLabel={errorLabel(file.name)}
                  unsaved={fiddle.dirtyFiles.includes(file.name)}
                  unsavedLabel={t('unsaved')}
                >
                  <span dir="ltr">{file.name}</span>
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </div>
        {!split && <span className={styles.process}>{t(processLabelKey[processOf(active)])}</span>}
        <Tooltip label={split ? t('closeSplit') : t('splitEditor')} kbd={split ? undefined : splitKbd}>
          <IconButton
            icon="columns"
            size="sm"
            label={split ? t('closeSplit') : t('splitEditor')}
            isPressed={split !== null}
            onPress={onToggleSplit}
          />
        </Tooltip>
      </div>
      <div className={styles.panes} data-tour="editor">
        {split ? (
          <>
            <div className={styles.pane}>
              <PaneHeader
                name={active}
                errors={errorLabel(active)}
                onMaximize={() => onMaximize(active)}
                onClose={onCloseLeft}
              />
              <EditorPane file={active} primary />
            </div>
            <div className={styles.divider} />
            <div className={styles.pane}>
              <PaneHeader
                name={split}
                errors={errorLabel(split)}
                onMaximize={() => onMaximize(split)}
                onClose={onCloseRight}
              />
              <EditorPane file={split} />
            </div>
          </>
        ) : (
          <EditorPane file={active} primary />
        )}
      </div>
      {consoleArea}
    </>
  );
}

interface PaneHeaderProps {
  name: string;
  errors: string | undefined;
  onMaximize: () => void;
  onClose: () => void;
}

/** Split view pane header: grip, filename (spark with its error count), process label, actions. */
function PaneHeader({ name, errors, onMaximize, onClose }: PaneHeaderProps) {
  const { t } = useTranslation('shell');
  return (
    <div className={styles.paneHeader}>
      <Icon name="grip" className={styles.grip} />
      <span className={styles.paneName} data-error={errors ? true : undefined}>
        {errors && <Icon name="warning" />}
        <span dir="ltr">{name}</span>
        {errors && <span className={styles.paneErrors}>{errors}</span>}
      </span>
      <span className={styles.paneProcess}>{t(processLabelKey[processOf(name)])}</span>
      <span className={styles.paneActions}>
        <Tooltip label={t('maximize')}>
          <IconButton icon="maximize" size="sm" label={t('maximize')} onPress={onMaximize} />
        </Tooltip>
        <Tooltip label={t('closePane')}>
          <IconButton icon="close" size="sm" label={t('closePane')} onPress={onClose} />
        </Tooltip>
      </span>
    </div>
  );
}
