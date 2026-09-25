import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  isModified,
  parseSetting,
  type SettingKey,
  type Settings,
} from '../../../shared/settings';
import { Button, IconButton, Switch, TextField } from '../../../ui';
import { useLatest } from '../../hooks';
import styles from './SettingsPage.module.css';
import { useSettings } from './use-settings';

export interface SearchState {
  query: string;
  /** The section's own title matched, so every row shows. */
  showAll: boolean;
}

export const SearchContext = createContext<SearchState>({ query: '', showAll: true });

export function matchesQuery(query: string, ...texts: string[]): boolean {
  const needle = query.trim().toLocaleLowerCase();
  return needle === '' || texts.some((text) => text.toLocaleLowerCase().includes(needle));
}

/** A setting, or the macOS privacy reset: a row with a title and description in the catalog but no value. */
export type RowKey = SettingKey | 'privacyReset';

export function useSettingText(key: RowKey): { title: string; description: string } {
  const { t } = useTranslation('settings');
  return { title: t(`${key}.title`), description: t(`${key}.description`) };
}

export const titleId = (setting: RowKey) => `setting-${setting}`;
export const descriptionId = (setting: RowKey) => `setting-${setting}-description`;

export interface RowProps {
  setting: RowKey;
  /** Text on the left, a compact control on the right. */
  inline?: boolean;
  /** Extra status text under the description. */
  note?: ReactNode;
  children: ReactNode;
}

export function Row({ setting, inline, note, children }: RowProps) {
  const { t } = useTranslation('settings');
  const { settings, reset } = useSettings();
  const { title, description } = useSettingText(setting);
  const search = useContext(SearchContext);
  if (!search.showAll && !matchesQuery(search.query, title, description, setting))
    return null;

  const modified = setting !== 'privacyReset' && isModified(settings, setting);
  return (
    <div className={styles.row} data-inline={inline || undefined} data-setting={setting}>
      <div className={styles.rowText}>
        <div className={styles.rowHead}>
          <span id={titleId(setting)} className={styles.rowTitle}>
            {title}
          </span>
          {modified && (
            <>
              <span
                className={styles.modified}
                role="img"
                aria-label={t('modified')}
                title={t('modified')}
              />
              <Button
                id={`${titleId(setting)}-reset`}
                aria-labelledby={`${titleId(setting)}-reset ${titleId(setting)}`}
                size="sm"
                variant="ghost"
                onPress={() => reset(setting)}
              >
                {t('reset')}
              </Button>
            </>
          )}
        </div>
        <p id={descriptionId(setting)} className={styles.rowDescription}>
          {description}
        </p>
        {note && <p className={styles.rowDescription}>{note}</p>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

type KeysOf<V> = { [K in SettingKey]: Settings[K] extends V ? K : never }[SettingKey];

export function SwitchRow({ setting }: { setting: KeysOf<boolean> }) {
  const { settings, set } = useSettings();
  const { title } = useSettingText(setting);
  return (
    <Row setting={setting} inline>
      <Switch
        aria-label={title}
        aria-describedby={descriptionId(setting)}
        isSelected={settings[setting]}
        onChange={(on) => set(setting, on)}
      />
    </Row>
  );
}

export interface TextRowProps {
  setting: KeysOf<string> | 'editorFontSize';
  invalidMessage: string;
  placeholder?: string;
  mono?: boolean;
}

/** A field commits on blur or Enter, and when the page closes under it (Escape, the shortcut), which blurs nothing. */
function useCommitOnUnmount(commit: () => void): void {
  const latest = useLatest(commit);
  useEffect(() => () => latest.current(), [latest]);
}

export function TextRow({ setting, invalidMessage, placeholder, mono }: TextRowProps) {
  const { settings, set } = useSettings();
  const { title } = useSettingText(setting);
  const numeric = setting === 'editorFontSize';
  const stored = settings[setting] === null ? '' : String(settings[setting]);
  const [draft, setDraft] = useState(stored);
  const [invalid, setInvalid] = useState(false);
  // A new value from the store (another window, a reset) replaces the draft.
  const [synced, setSynced] = useState(stored);
  if (synced !== stored) {
    setSynced(stored);
    setDraft(stored);
    setInvalid(false);
  }

  const commit = () => {
    const text = draft.trim();
    const value = numeric ? (text === '' ? null : Number(text)) : text;
    if (!parseSetting(setting, value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (text !== stored) set(setting, value as never);
  };
  useCommitOnUnmount(commit);

  return (
    <Row setting={setting}>
      <TextField
        className={styles.field}
        aria-label={title}
        aria-describedby={descriptionId(setting)}
        value={draft}
        placeholder={placeholder}
        mono={mono}
        inputMode={numeric ? 'numeric' : undefined}
        isInvalid={invalid}
        errorMessage={invalid ? invalidMessage : undefined}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) commit();
        }}
      />
    </Row>
  );
}

export interface ListRowProps {
  setting: 'electronFlags' | 'environmentVariables';
  invalidMessage?: string;
}

/** A list of text rows. Empty rows are dropped; invalid rows block the commit and are marked. */
export function ListRow({ setting, invalidMessage }: ListRowProps) {
  const { t } = useTranslation('settings');
  const { settings, set } = useSettings();
  const { title } = useSettingText(setting);
  const stored = settings[setting];
  const storedKey = JSON.stringify(stored);
  const [rows, setRows] = useState<string[]>(stored);
  const [invalid, setInvalid] = useState<ReadonlySet<number>>(new Set());
  const [synced, setSynced] = useState(storedKey);
  if (synced !== storedKey) {
    setSynced(storedKey);
    setRows(stored);
    setInvalid(new Set());
  }

  const commit = (next: string[]) => {
    const bad = new Set<number>();
    next.forEach((row, index) => {
      if (row.trim() && !parseSetting(setting, [row.trim()])) bad.add(index);
    });
    setInvalid(bad);
    if (bad.size > 0) return;
    const values = next.map((row) => row.trim()).filter(Boolean);
    if (JSON.stringify(values) !== storedKey) set(setting, values);
  };
  useCommitOnUnmount(() => commit(rows));

  return (
    <Row setting={setting}>
      <div className={styles.list}>
        {rows.map((row, index) => (
          <div key={index} className={styles.listRow}>
            <TextField
              className={styles.listField}
              aria-label={title}
              aria-describedby={descriptionId(setting)}
              value={row}
              mono
              isInvalid={invalid.has(index)}
              errorMessage={invalid.has(index) ? invalidMessage : undefined}
              onChange={(text) =>
                setRows(rows.map((old, i) => (i === index ? text : old)))
              }
              onBlur={() => commit(rows)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) commit(rows);
              }}
            />
            <IconButton
              icon="close"
              size="sm"
              variant="ghost"
              label={t('list.remove')}
              onPress={() => {
                const next = rows.filter((_, i) => i !== index);
                setRows(next);
                commit(next);
              }}
            />
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          icon="plus"
          onPress={() => setRows([...rows, ''])}
        >
          {t('list.add')}
        </Button>
      </div>
    </Row>
  );
}
