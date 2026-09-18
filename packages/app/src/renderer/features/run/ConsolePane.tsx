/**
 * The output console: a bar with the title, a process filter, a text filter,
 * the Running badge and a clear button, then the lines. An error row's location
 * is a link that reveals it in the editor. http(s) URLs are links that ask
 * before they open in the browser. Auto-scrolls while at the bottom.
 */
import { Fragment, memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useFormat } from '../../../i18n/renderer';
import { runApi } from '../../../ipc/renderer';
import type { OutputLine } from '../../../shared/stores';
import {
  Button,
  IconButton,
  SegmentedControl,
  StatusPill,
  TextField,
  Tooltip,
} from '../../../ui';
import { revealLocation } from '../../editor/runtime-errors';
import styles from './Console.module.css';
import { linkify } from './linkify';
import { useConsoleLines, useRunState } from './use-run';

type ProcessFilter = 'all' | 'main' | 'renderer';

const processKey = {
  fiddle: 'processFiddle',
  main: 'processMain',
  renderer: 'processRenderer',
} as const satisfies Record<OutputLine['process'], string>;

const TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
};

const clear = () => {
  runApi
    .ClearOutput()
    .catch((error: unknown) =>
      console.error('[fiddle] clearing the console failed', error),
    );
};

/** Memoized: the splitters and the window's size re-render its parents, and a full console has a thousand rows. */
export const ConsolePane = memo(function ConsolePane() {
  const { t } = useTranslation('run');
  const lines = useConsoleLines();
  const run = useRunState();
  const [filter, setFilter] = useState<ProcessFilter>('all');
  const [query, setQuery] = useState('');
  const { formatDate } = useFormat();
  const processLabels: Record<OutputLine['process'], string> = {
    fiddle: t(processKey.fiddle),
    main: t(processKey.main),
    renderer: t(processKey.renderer),
  };

  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      lines.filter(
        (line) =>
          (filter === 'all' || line.process === filter) &&
          (!needle || line.text.toLowerCase().includes(needle)),
      ),
    [lines, filter, needle],
  );

  // Stick to the bottom unless the user scrolled up.
  const list = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);
  useLayoutEffect(() => {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [shown.length, lines]);

  return (
    <section className={styles.pane} aria-label={t('console')} data-tour="console">
      <div className={styles.bar}>
        <h2 className={styles.title}>{t('console')}</h2>
        <SegmentedControl
          size="sm"
          label={t('filterProcess')}
          value={filter}
          onChange={(value) => setFilter(value as ProcessFilter)}
          options={[
            { value: 'all', label: t('filterAll') },
            { value: 'main', label: t('filterMain') },
            { value: 'renderer', label: t('filterRenderer') },
          ]}
        />
        <TextField
          size="sm"
          icon="search"
          aria-label={t('filterOutput')}
          placeholder={t('filterOutput')}
          value={query}
          onChange={setQuery}
          className={styles.filter}
        />
        <span className={styles.spacer} />
        {run.status === 'running' && <StatusPill>{t('running')}</StatusPill>}
        <Tooltip label={t('clearConsole')}>
          <IconButton icon="trash" size="sm" label={t('clearConsole')} onPress={clear} />
        </Tooltip>
      </div>
      <ol
        ref={list}
        className={styles.rows}
        aria-label={t('consoleOutput')}
        dir="ltr"
        tabIndex={0}
        onScroll={(event) => {
          const el = event.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {shown.map((line) => (
          <ConsoleRow
            key={line.seq}
            line={line}
            processLabel={processLabels[line.process]}
            formatDate={formatDate}
          />
        ))}
      </ol>
    </section>
  );
});

const ConsoleRow = memo(function ConsoleRow({
  line,
  processLabel,
  formatDate,
}: {
  line: OutputLine;
  processLabel: string;
  formatDate: (value: number, options: Intl.DateTimeFormatOptions) => string;
}) {
  return (
    <li className={styles.row} data-kind={line.kind}>
      <span className={styles.time}>{formatDate(line.time, TIME)}</span>
      <span className={styles.process}>{processLabel}</span>
      <span className={styles.message}>
        <LinkedText text={line.text} />
        {line.location && <Location location={line.location} />}
      </span>
    </li>
  );
});

/**
 * A line with its http(s) URLs as links. A link opens as a new window, which
 * main turns into "Open this link in your browser?" (`openExternalLink`).
 */
function LinkedText({ text }: { text: string }) {
  if (!text.includes('://')) return text;
  return linkify(text).map((segment, index) =>
    segment.url ? (
      <a
        key={index}
        href={segment.url}
        target="_blank"
        rel="noreferrer"
        className={styles.link}
      >
        {segment.text}
      </a>
    ) : (
      <Fragment key={index}>{segment.text}</Fragment>
    ),
  );
}

function Location({ location }: { location: NonNullable<OutputLine['location']> }) {
  const { t } = useTranslation('run');
  const text = [location.file, location.line, location.column]
    .filter((part) => part !== undefined)
    .join(':');
  return (
    <>
      {' ('}
      <Button
        variant="link"
        aria-label={t('revealLocation', { location: text })}
        onPress={() => revealLocation(location.file, location.line, location.column ?? 1)}
      >
        {text}
      </Button>
      {')'}
    </>
  );
}
