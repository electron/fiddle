import { Fragment, useLayoutEffect, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { dropOnPane, MAX_PANES, type PaneDropPosition } from '../../shared/panes';
import type { WindowState } from '../../shared/stores';
import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  SplitHandle,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Tooltip,
} from '../../ui';
import { badgeOf, useDiagnostics } from '../editor/diagnostics';
import { EditorPane } from '../editor/EditorPane';
import { ConsolePane } from '../features/run/ConsolePane';
import { SettingsPage } from '../features/settings/SettingsPage';
import { useShortcut } from '../use-shortcut';
import { processOf, type FileProcess } from './processes';
import styles from './Sheet.module.css';
import { isTabDrag, TAB_DRAG_TYPE, useTabDrag } from './tab-drag';
import { useDraft } from './use-draft';

const CONSOLE_MIN = 96;
const CONSOLE_DEFAULT = 160;
/** Dragging the console's splitter below this closes the console. */
const CONSOLE_COLLAPSE = CONSOLE_MIN / 2;
const PANE_MIN = 160;

export const processLabelKey = {
  main: 'processMain',
  preload: 'processPreload',
  renderer: 'processRenderer',
  other: 'processOther',
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
      setSize({
        width: entry?.contentRect.width ?? 0,
        height: entry?.contentRect.height ?? 0,
      }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return size;
}

/** Each pane's width in px for its share of `total`: at least `PANE_MIN`, the last one taking what's left. */
function paneWidths(total: number, shares: readonly number[]): number[] {
  const widths = shares.map((share) => Math.max(PANE_MIN, Math.round(total * share)));
  const last = widths.length - 1;
  if (last >= 0)
    widths[last] = Math.max(
      PANE_MIN,
      total - widths.slice(0, last).reduce((sum, w) => sum + w, 0),
    );
  return widths;
}

export interface SheetProps {
  state: WindowState;
  /** The focused pane's file, which the tab row selects; null when no file is open. */
  active: string | null;
  /** The files in the editor panes, from the start. One entry means the editor isn't split. */
  panes: readonly string[];
  onSelectFile: (name: string) => void;
  onCloseFile: (name: string) => void;
  /** A tab was dragged along the row: its file goes in front of `before`'s, or to the end. */
  onMoveFile: (name: string, before: string | null) => void;
  /** A tab was dropped on pane `index`: in its middle, or on the edge where a new pane opens. */
  onDropOnPane: (name: string, index: number, position: PaneDropPosition) => void;
  onFocusPane: (name: string) => void;
  onToggleSplit: () => void;
  onClosePane: (name: string) => void;
  onMaximize: (name: string) => void;
  onConsoleHeight: (height: number) => void;
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
      {state.view === 'settings' && (
        <div className={styles.settings}>
          <SettingsPage />
        </div>
      )}
      {/* Kept mounted under the Settings page, so the editors' cursors, scroll and undo history and the console's filters survive a visit. */}
      <div
        className={styles.editor}
        data-covered={state.view === 'settings' || undefined}
      >
        <EditorArea {...props} sheetHeight={height} />
      </div>
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
  active,
  panes,
  onSelectFile,
  onCloseFile,
  onMoveFile,
  onDropOnPane,
  onFocusPane,
  onToggleSplit,
  onClosePane,
  onMaximize,
  onConsoleHeight,
  onHideConsole,
  onResetLayout,
  sheetHeight,
}: SheetProps & { sheetHeight: number }) {
  const { t, i18n } = useTranslation('shell');
  const rtl = i18n.dir() === 'rtl';
  const { fiddle, layout } = state;
  const diagnostics = useDiagnostics();
  const badgeLabel = useBadgeLabel();
  const badge = (name: string) => badgeOf(diagnostics.get(name));
  const visible = fiddle.files.filter((file) => file.visible);
  const visibleNames = visible.map((file) => file.name);
  const split = panes.length > 1;
  const splitKbd = useShortcut('view.toggleSplit');
  const dragged = useTabDrag();

  // The console: 96px to half the sheet; dragged below half the minimum, it closes.
  const consoleMax = Math.max(CONSOLE_MIN, Math.floor(sheetHeight / 2));
  const [consoleHeight, setConsoleHeight] = useDraft(
    layout.consoleHeight,
    onConsoleHeight,
  );
  const shownConsoleHeight = Math.min(Math.max(consoleHeight, CONSOLE_MIN), consoleMax);
  const resizeConsole = (value: number) => {
    if (value < CONSOLE_COLLAPSE) onHideConsole();
    else setConsoleHeight(Math.max(value, CONSOLE_MIN));
  };

  // Pane widths: each pane's share of the row, local to this window, equal again whenever the pane count changes.
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const rowWidth = useSize(row).width;
  const [shares, setShares] = useState<number[]>([]);
  const paneShares =
    shares.length === panes.length ? shares : panes.map(() => 1 / panes.length);
  const widths = paneWidths(rowWidth, paneShares);
  /** The divider after pane `index` moved: that pane takes `width`, its neighbour gives or takes the difference. */
  const resizePane = (index: number, width: number) => {
    if (!rowWidth) return;
    const next = [...widths];
    next[index + 1] = (next[index + 1] ?? 0) + (next[index] ?? 0) - width;
    next[index] = width;
    setShares(next.map((w) => w / rowWidth));
  };

  const [insert, setInsert] = useState<{ before: string | null } | null>(null);
  /** In front of the tab under the pointer on its near half, after it on its far half, at the end past the last tab. */
  const insertionPoint = (event: DragEvent<HTMLElement>): string | null => {
    const tab =
      event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    const index = tab
      ? [...event.currentTarget.querySelectorAll('[role="tab"]')].indexOf(tab)
      : -1;
    if (!tab || index === -1) return null;
    const rect = tab.getBoundingClientRect();
    const nearHalf = event.clientX < rect.left + rect.width / 2 !== rtl;
    return (nearHalf ? visibleNames[index] : visibleNames[index + 1]) ?? null;
  };
  /** Dropping a tab where it already is changes nothing, so no indicator shows there. */
  const isNoMove = (name: string, before: string | null) => {
    const index = visibleNames.indexOf(name);
    return (
      before === name ||
      (before === null
        ? index === visibleNames.length - 1
        : visibleNames.indexOf(before) === index + 1)
    );
  };
  const indicatorFor = (name: string, last: boolean): 'before' | 'after' | undefined => {
    if (!dragged || !insert || isNoMove(dragged, insert.before)) return undefined;
    if (insert.before === name) return 'before';
    return insert.before === null && last ? 'after' : undefined;
  };
  const onRowDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isTabDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const before = insertionPoint(event);
    setInsert((current) => (current?.before === before ? current : { before }));
  };
  const onRowDrop = (event: DragEvent<HTMLDivElement>) => {
    setInsert(null);
    const name = event.dataTransfer.getData(TAB_DRAG_TYPE);
    if (!name) return;
    event.preventDefault();
    const before = insertionPoint(event);
    if (!isNoMove(name, before)) onMoveFile(name, before);
  };

  /** The drop zones pane `index` offers the dragged tab: those that change the panes and stay within `MAX_PANES`. */
  const dropZonesFor = (index: number): PaneDropPosition[] => {
    if (!dragged) return [];
    const positions: PaneDropPosition[] = ['before', 'center', 'after'];
    return positions.filter((position) => {
      const next = dropOnPane(panes, dragged, index, position);
      return (
        next.length <= MAX_PANES &&
        (next.length !== panes.length || next.some((name, i) => name !== panes[i]))
      );
    });
  };

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
              <Button
                variant="secondary"
                size="sm"
                icon="refresh"
                onPress={onResetLayout}
              >
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
      <Tabs value={active} onChange={onSelectFile} className={styles.tabsRoot}>
        {/* The whole row takes a dragged tab: past the last tab it goes to the end. */}
        <div
          className={styles.tabrow}
          data-tab-dragging={dragged ? '' : undefined}
          onDragOver={onRowDragOver}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setInsert(null);
          }}
          onDrop={onRowDrop}
        >
          <div className={styles.tabs}>
            <TabList aria-label={t('openFiles')}>
              {visible.map((file, index) => {
                const fileBadge = badge(file.name);
                const errorLabel = badgeLabel(fileBadge);
                return (
                  <Tab
                    key={file.name}
                    id={file.name}
                    // A file showing in another pane than the focused one carries the split glyph.
                    icon={
                      split && file.name !== active && panes.includes(file.name)
                        ? 'columns'
                        : undefined
                    }
                    onClose={() => onCloseFile(file.name)}
                    drag={{ type: TAB_DRAG_TYPE, data: file.name }}
                    dropIndicator={indicatorFor(file.name, index === visible.length - 1)}
                    error={
                      fileBadge && errorLabel
                        ? {
                            count: fileBadge.count,
                            tone: fileBadge.tone,
                            label: errorLabel,
                          }
                        : undefined
                    }
                    unsaved={
                      fiddle.dirtyFiles.includes(file.name) ? t('unsaved') : undefined
                    }
                  >
                    <span dir="ltr">{file.name}</span>
                  </Tab>
                );
              })}
            </TabList>
          </div>
          {!split && (
            <span className={styles.process}>
              {t(processLabelKey[processOf(active)])}
            </span>
          )}
          <Tooltip
            label={split ? t('closeSplit') : t('splitEditor')}
            kbd={split ? undefined : splitKbd}
          >
            <IconButton
              icon="columns"
              size="sm"
              label={split ? t('closeSplit') : t('splitEditor')}
              isPressed={split}
              onPress={onToggleSplit}
            />
          </Tooltip>
        </div>
        <TabPanel id={active} className={styles.tabpanel}>
          <div ref={setRow} className={styles.panes} data-tour="editor">
            {panes.map((name, index) => {
              const last = index === panes.length - 1;
              return (
                // Keyed by position, so a pane keeps its editor while the file it shows changes.
                <Fragment key={index}>
                  {index > 0 && (
                    <SplitHandle
                      value={widths[index - 1] ?? PANE_MIN}
                      min={PANE_MIN}
                      max={
                        (widths[index - 1] ?? PANE_MIN) +
                        (widths[index] ?? PANE_MIN) -
                        PANE_MIN
                      }
                      onChange={(width) => resizePane(index - 1, width)}
                      onReset={() => setShares([])}
                      label={t('resizePanes')}
                      className={styles.divider}
                    />
                  )}
                  <div
                    className={styles.pane}
                    data-pane-index={index}
                    style={
                      split && !last && rowWidth
                        ? { flex: 'none', width: widths[index] }
                        : undefined
                    }
                  >
                    {split && (
                      <PaneHeader
                        name={name}
                        badge={badge(name)}
                        onMaximize={() => onMaximize(name)}
                        onClose={() => onClosePane(name)}
                      />
                    )}
                    <EditorPane
                      file={name}
                      primary={name === active}
                      onFocus={() => onFocusPane(name)}
                    />
                    {dragged && (
                      <PaneDropZones
                        zones={dropZonesFor(index)}
                        onDrop={(file, position) => onDropOnPane(file, index, position)}
                      />
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </TabPanel>
      </Tabs>
      {consoleArea}
    </>
  );
}

/**
 * A pane's drop target for a dragged tab: each edge (a quarter of the pane) opens the file in a new pane on that
 * side, the middle shows it here. Only `zones` that would change something are offered.
 */
function PaneDropZones({
  zones,
  onDrop,
}: {
  zones: readonly PaneDropPosition[];
  onDrop: (name: string, position: PaneDropPosition) => void;
}) {
  const [over, setOver] = useState<PaneDropPosition | null>(null);
  const accept = (position: PaneDropPosition) => (event: DragEvent) => {
    if (!isTabDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setOver(position);
  };
  if (zones.length === 0) return null;
  return (
    <div
      className={styles.dropZones}
      data-over={over ?? undefined}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOver(null);
      }}
    >
      {zones.map((position) => (
        <div
          key={position}
          className={styles.dropZone}
          data-drop-zone={position}
          onDragEnter={accept(position)}
          onDragOver={accept(position)}
          onDrop={(event) => {
            setOver(null);
            const name = event.dataTransfer.getData(TAB_DRAG_TYPE);
            if (!name) return;
            event.preventDefault();
            onDrop(name, position);
          }}
        />
      ))}
      <div className={styles.dropHint} aria-hidden="true" />
    </div>
  );
}

interface PaneHeaderProps {
  name: string;
  badge: Badge;
  onMaximize: () => void;
  onClose: () => void;
}

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
          <IconButton
            icon="maximize"
            size="sm"
            label={t('maximize')}
            onPress={onMaximize}
          />
        </Tooltip>
        <Tooltip label={t('closePane')}>
          <IconButton icon="close" size="sm" label={t('closePane')} onPress={onClose} />
        </Tooltip>
      </span>
    </div>
  );
}
