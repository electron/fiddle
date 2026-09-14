/**
 * The sheet: the tab row, one Monaco pane (or two when split), the console
 * and, when `Window.view` is `settings`, the settings page instead.
 */
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Platform, WindowState } from '../../shared/stores';
import { Button, EmptyState, Icon, IconButton, SplitHandle, Tab, TabList, Tabs, Tooltip } from '../../ui';
import { badgeOf, useDiagnostics } from '../editor/diagnostics';
import { EditorPane } from '../editor/EditorPane';
import { ConsolePane } from '../features/run/ConsolePane';
import { SettingsPage } from '../features/settings/SettingsPage';
import { processOf, type FileProcess } from './processes';
import styles from './Sheet.module.css';
import { useDraft } from './use-draft';

const CONSOLE_MIN = 96;
const CONSOLE_DEFAULT = 160;
/** Dragging the console's splitter below this closes the console (§17.7). */
const CONSOLE_COLLAPSE = CONSOLE_MIN / 2;
/** Each split pane keeps at least this width. */
const PANE_MIN = 160;

export const processLabelKey = {
  main: 'processMain',
  preload: 'processPreload',
  renderer: 'processRenderer',
} as const satisfies Record<FileProcess, string>;

type Badge = ReturnType<typeof badgeOf>;

/** A badge's text: "2 errors", or "1 warning" when the file has no errors. */
export function useBadgeLabel(): (badge: Badge) => string | undefined {
  const { t } = useTranslation('shell');
  return (badge) =>
    badge
      ? badge.tone === 'error'
        ? t('errorCount', { count: badge.count })
        : t('warningCount', { count: badge.count })
      : undefined;
}

/** An element's content size, kept current. ResizeObserver reports the first size on `observe`. */
function useSize(node: HTMLElement | null): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return size;
}

export interface SheetProps {
  state: WindowState;
  platform: Platform;
  onSelectFile: (name: string) => void;
  onToggleSplit: () => void;
  onCloseLeft: () => void;
  onCloseRight: () => void;
  onMaximize: (name: string) => void;
  onConsoleHeight: (height: number) => void;
  /** The console's splitter was dragged closed. */
  onHideConsole: () => void;
  onResetLayout: () => void;
  /** Something droppable is being dragged over the window. */
  dropping: boolean;
}

export function Sheet(props: SheetProps) {
  const { t } = useTranslation('shell');
  const { state } = props;
  const [sheet, setSheet] = useState<HTMLElement | null>(null);
  const { height } = useSize(sheet);

  return (
    <section ref={setSheet} className={styles.sheet}>
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
  onSelectFile,
  onToggleSplit,
  onCloseLeft,
  onCloseRight,
  onMaximize,
  onConsoleHeight,
  onHideConsole,
  onResetLayout,
  sheetHeight,
}: SheetProps & { sheetHeight: number }) {
  const { t, i18n } = useTranslation('shell');
  const { fiddle, layout } = state;
  const diagnostics = useDiagnostics();
  const badgeLabel = useBadgeLabel();
  const badge = (name: string) => badgeOf(diagnostics.get(name));
  const visible = fiddle.files.filter((file) => file.visible);
  const names = fiddle.files.map((file) => file.name);
  const active =
    fiddle.activeFile && visible.some((file) => file.name === fiddle.activeFile)
      ? fiddle.activeFile
      : (visible[0]?.name ?? null);
  const split = layout.split && names.includes(layout.split) ? layout.split : null;
  const splitKbd = platform === 'darwin' ? '⌘\\' : 'Ctrl+\\';

  // The console: 96px to half the sheet; dragged below half the minimum, it closes.
  const consoleMax = Math.max(CONSOLE_MIN, Math.floor(sheetHeight / 2));
  const [consoleHeight, setConsoleHeight] = useDraft(layout.consoleHeight, onConsoleHeight);
  const shownConsoleHeight = Math.min(Math.max(consoleHeight, CONSOLE_MIN), consoleMax);
  const resizeConsole = (value: number) => {
    if (value < CONSOLE_COLLAPSE) onHideConsole();
    else setConsoleHeight(Math.max(value, CONSOLE_MIN));
  };

  // Split panes: the left pane's share of the width, while this window shows them.
  const [panes, setPanes] = useState<HTMLDivElement | null>(null);
  const panesWidth = useSize(panes).width;
  const [ratio, setRatio] = useState(0.5);
  const leftMax = Math.max(PANE_MIN, panesWidth - PANE_MIN);
  const leftWidth = Math.min(leftMax, Math.max(PANE_MIN, Math.round(panesWidth * ratio)));

  const consoleArea = layout.consoleVisible && (
    <>
      <SplitHandle
        orientation="horizontal"
        value={shownConsoleHeight}
        min={0}
        max={consoleMax}
        reverse
        onChange={resizeConsole}
        onReset={() => setConsoleHeight(CONSOLE_DEFAULT)}
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
              {visible.map((file) => {
                const fileBadge = badge(file.name);
                return (
                  <Tab
                    key={file.name}
                    id={file.name}
                    errorCount={fileBadge?.count}
                    errorTone={fileBadge?.tone}
                    errorLabel={badgeLabel(fileBadge)}
                    unsaved={fiddle.dirtyFiles.includes(file.name)}
                    unsavedLabel={t('unsaved')}
                  >
                    <span dir="ltr">{file.name}</span>
                  </Tab>
                );
              })}
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
      <div ref={setPanes} className={styles.panes} data-tour="editor">
        {split ? (
          <>
            <div className={styles.pane} style={panesWidth ? { flex: 'none', width: leftWidth } : undefined}>
              <PaneHeader
                name={active}
                badge={badge(active)}
                onMaximize={() => onMaximize(active)}
                onClose={onCloseLeft}
              />
              <EditorPane file={active} primary />
            </div>
            <SplitHandle
              value={leftWidth}
              min={PANE_MIN}
              max={leftMax}
              // In a right-to-left layout the first pane is on the right.
              reverse={i18n.dir() === 'rtl'}
              onChange={(width) => panesWidth && setRatio(width / panesWidth)}
              onReset={() => setRatio(0.5)}
              label={t('resizePanes')}
              className={styles.divider}
            />
            <div className={styles.pane}>
              <PaneHeader
                name={split}
                badge={badge(split)}
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
  badge: Badge;
  onMaximize: () => void;
  onClose: () => void;
}

/** Split view pane header: grip, filename (spark or warning, with its count), process label, actions. */
function PaneHeader({ name, badge, onMaximize, onClose }: PaneHeaderProps) {
  const { t } = useTranslation('shell');
  const label = useBadgeLabel()(badge);
  return (
    <div className={styles.paneHeader}>
      <Icon name="grip" className={styles.grip} />
      <span className={styles.paneName} data-tone={badge?.tone}>
        {badge && <Icon name="warning" />}
        <span dir="ltr">{name}</span>
        {label && <span className={styles.paneErrors}>{label}</span>}
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
