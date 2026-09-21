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
} from '../../ui';
import { useBadges, type Badge } from '../editor/diagnostics';
import { EditorPane } from '../editor/EditorPane';
import { ConsolePane } from '../features/run/ConsolePane';
import { SettingsPage } from '../features/settings/SettingsPage';
import { useShortcut } from '../hooks';
import type { PaneActions } from './pane-actions';
import { processOf } from './processes';
import styles from './Sheet.module.css';
import { isTabDrag, TAB_DRAG_TYPE, useTabDrag } from './tab-drag';
import { useDraft } from './use-draft';

const CONSOLE_MIN = 96;
const CONSOLE_DEFAULT = 160;
/** Dragging the console's splitter below this closes the console. */
const CONSOLE_COLLAPSE = CONSOLE_MIN / 2;
const PANE_MIN = 160;

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
  actions: PaneActions;
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

function EditorArea({ state, actions, sheetHeight }: SheetProps & { sheetHeight: number }) {
  const { t, i18n } = useTranslation('shell');
  const rtl = i18n.dir() === 'rtl';
  const { fiddle, layout } = state;
  const { active, panes } = actions;
  const badge = useBadges();
  const visible = fiddle.files.filter((file) => file.visible);
  const visibleNames = visible.map((file) => file.name);
  const split = panes.length > 1;
  const splitKbd = useShortcut('view.toggleSplit');
  const dragged = useTabDrag();

  // The console: 96px to half the sheet; dragged below half the minimum, it closes.
  const consoleMax = Math.max(CONSOLE_MIN, Math.floor(sheetHeight / 2));
  const [consoleHeight, setConsoleHeight] = useDraft(layout.consoleHeight, (height) =>
    actions.changeLayout({ consoleHeight: height }),
  );
  const shownConsoleHeight = Math.min(Math.max(consoleHeight, CONSOLE_MIN), consoleMax);
  const resizeConsole = (value: number) => {
    if (value < CONSOLE_COLLAPSE) actions.changeLayout({ consoleVisible: false });
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
    if (!isNoMove(name, before)) actions.moveFile(name, before);
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
                onPress={actions.resetLayout}
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
      <Tabs value={active} onChange={actions.openFile} className={styles.tabsRoot}>
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
              {visible.map((file, index) => (
                  <Tab
                    key={file.name}
                    id={file.name}
                    // A file showing in another pane than the focused one carries the split glyph.
                    icon={
                      split && file.name !== active && panes.includes(file.name)
                        ? 'columns'
                        : undefined
                    }
                    onClose={() => actions.closeFile(file.name)}
                    drag={{ type: TAB_DRAG_TYPE, data: file.name }}
                    dropIndicator={indicatorFor(file.name, index === visible.length - 1)}
                    error={badge(file.name)}
                    unsaved={
                      fiddle.dirtyFiles.includes(file.name) ? t('unsaved') : undefined
                    }
                  >
                    <span dir="ltr">{file.name}</span>
                  </Tab>
              ))}
            </TabList>
          </div>
          {!split && (
            <span className={styles.process}>
              {t(`process.${processOf(active)}`)}
            </span>
          )}
          <IconButton
            icon="columns"
            size="sm"
            label={split ? t('closeSplit') : t('splitEditor')}
            tooltip={{ kbd: split ? undefined : splitKbd }}
            isPressed={split}
            onPress={actions.toggleSplit}
          />
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
                        onMaximize={() => actions.maximize(name)}
                        onClose={() => actions.closePane(name)}
                      />
                    )}
                    <EditorPane
                      file={name}
                      primary={name === active}
                      onFocus={() => actions.focusPane(name)}
                    />
                    {dragged && (
                      <PaneDropZones
                        zones={dropZonesFor(index)}
                        onDrop={(file, position) => actions.dropTab(file, index, position)}
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
  badge: Badge | undefined;
  onMaximize: () => void;
  onClose: () => void;
}

function PaneHeader({ name, badge, onMaximize, onClose }: PaneHeaderProps) {
  const { t } = useTranslation('shell');
  return (
    <div className={styles.paneHeader}>
      <Icon name="grip" className={styles.grip} />
      <span className={styles.paneName} data-tone={badge?.tone}>
        {badge && <Icon name="warning" />}
        <span dir="ltr">{name}</span>
        {badge && <span className={styles.paneErrors}>{badge.label}</span>}
      </span>
      <span className={styles.paneProcess}>{t(`process.${processOf(name)}`)}</span>
      <span className={styles.paneActions}>
        <IconButton
          icon="maximize"
          size="sm"
          label={t('maximize')}
          tooltip
          onPress={onMaximize}
        />
        <IconButton
          icon="close"
          size="sm"
          label={t('closePane')}
          tooltip
          onPress={onClose}
        />
      </span>
    </div>
  );
}
