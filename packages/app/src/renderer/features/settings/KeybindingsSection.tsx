/**
 * Every command in the registry with its shortcut. Record a new shortcut,
 * remove it (a `null` override) or reset it. Shared shortcuts are flagged.
 * Only overrides are stored, under `keybindings`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  acceleratorFor,
  commandIds,
  commands,
  isCommandListed,
  type CommandId,
} from '../../../shared/commands';
import {
  acceleratorFromKey,
  effectiveAccelerators,
  findConflicts,
  normalizeAccelerator,
} from '../../../shared/settings';
import { acceleratorKeys } from '../../../shared/accelerators';
import type { Platform } from '../../../shared/stores';
import { Button, Icon, IconButton, Kbd, TextField } from '../../../ui';
import { matchesQuery, Row } from './controls';
import styles from './SettingsPage.module.css';
import { useSettings } from './use-settings';

export function KeybindingsSection() {
  const { t } = useTranslation('settings');
  const { t: tMain } = useTranslation('main');
  const { app, settings, set } = useSettings();
  const platform: Platform = app?.platform ?? 'linux';
  const locale = app?.locale ?? 'en';
  const overrides = settings.keybindings;
  const [filter, setFilter] = useState('');
  const [recording, setRecording] = useState<CommandId | null>(null);
  // The row whose Change button gets focus back once its recorder is gone.
  const refocus = useRef<CommandId | null>(null);
  useEffect(() => {
    if (recording !== null || refocus.current === null) return;
    document
      .querySelector<HTMLElement>(`[data-command="${refocus.current}"] button`)
      ?.focus();
    refocus.current = null;
  }, [recording]);

  const conflicts = useMemo(
    () => findConflicts(platform, overrides),
    [platform, overrides],
  );
  const list = useMemo(
    () => new Intl.ListFormat(locale, { type: 'conjunction' }),
    [locale],
  );
  const label = (id: CommandId) => tMain(commands[id].label);

  // Dev-only commands (the Develop menu's) only in development builds.
  const rows = commandIds
    .filter((id) => isCommandListed(id, app))
    .map((id) => ({ id, label: label(id) }))
    .filter((row) => matchesQuery(filter, row.label, row.id))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  const save = (id: CommandId, accelerator: string | null | undefined) => {
    const next = { ...overrides };
    if (
      accelerator === undefined ||
      accelerator === (acceleratorFor(id, platform) ?? null)
    )
      delete next[id];
    else next[id] = accelerator;
    set('keybindings', next);
  };

  return (
    <Row setting="keybindings">
      <div className={styles.stack}>
        <TextField
          className={styles.field}
          size="sm"
          icon="search"
          aria-label={t('keybindings.filter')}
          placeholder={t('keybindings.filter')}
          value={filter}
          onChange={setFilter}
        />
        <ul className={styles.shortcuts}>
          {rows.map(({ id, label: name }) => {
            // Every shortcut: some commands have two (F5 also runs the fiddle).
            const accelerators = effectiveAccelerators(id, platform, overrides);
            const overridden = Object.hasOwn(overrides, id);
            const others = [
              ...new Set(
                accelerators.flatMap(
                  (accelerator) =>
                    conflicts.get(normalizeAccelerator(accelerator, platform)) ?? [],
                ),
              ),
            ].filter((other) => other !== id);
            return (
              <li key={id} className={styles.shortcut} data-command={id}>
                <div className={styles.shortcutText}>
                  <span className={styles.shortcutLabel}>
                    {name}
                    {overridden && (
                      <span
                        className={styles.modified}
                        role="img"
                        aria-label={t('modified')}
                      />
                    )}
                  </span>
                  {others.length > 0 && (
                    <span className={styles.conflict}>
                      <Icon name="warning" size={12} />
                      {t('keybindings.conflict', {
                        commands: list.format(others.map(label)),
                      })}
                    </span>
                  )}
                </div>
                {recording === id ? (
                  <Recorder
                    label={t('keybindings.recordLabel', { command: name })}
                    placeholder={t('keybindings.record')}
                    platform={platform}
                    onDone={(value, byKey) => {
                      if (byKey) refocus.current = id;
                      setRecording(null);
                      if (value) save(id, value);
                    }}
                  />
                ) : accelerators.length > 0 ? (
                  <span className={styles.shortcutKeys}>
                    {accelerators.map((accelerator) => (
                      <Kbd
                        key={accelerator}
                        keys={acceleratorKeys(accelerator, platform)}
                      />
                    ))}
                  </span>
                ) : (
                  <span className={styles.none}>{t('keybindings.none')}</span>
                )}
                <div className={styles.shortcutActions}>
                  <Button size="sm" variant="secondary" onPress={() => setRecording(id)}>
                    {t('keybindings.change')}
                  </Button>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon="minus"
                    label={t('keybindings.remove')}
                    isDisabled={accelerators.length === 0}
                    onPress={() => save(id, null)}
                  />
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon="refresh"
                    label={t('keybindings.resetLabel', { command: name })}
                    isDisabled={!overridden}
                    onPress={() => save(id, undefined)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Row>
  );
}

interface RecorderProps {
  label: string;
  placeholder: string;
  platform: Platform;
  /** Called with the new accelerator, or nothing when cancelled. `byKey`: ended by a key press, not by focus leaving. */
  onDone(accelerator?: string, byKey?: boolean): void;
}

const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/;

/**
 * Captures the next key combination. Escape or leaving the field cancels; Tab
 * and Shift+Tab move on. A key with no Ctrl, Cmd or Alt would be taken from
 * every text field, so only function keys are recorded without one.
 */
function Recorder({ label, placeholder, platform, onDone }: RecorderProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <input
      ref={ref}
      readOnly
      // The keybinding dispatcher leaves keys pressed here alone.
      data-keybinding-recorder
      className={styles.recorder}
      aria-label={label}
      placeholder={placeholder}
      onBlur={() => onDone()}
      onKeyDown={(event) => {
        const chord = event.metaKey || event.ctrlKey || event.altKey;
        if (event.key === 'Tab' && !chord) return;
        event.preventDefault();
        // Keep Escape from closing the settings page.
        event.stopPropagation();
        if (event.key === 'Escape' && !chord && !event.shiftKey) {
          onDone(undefined, true);
          return;
        }
        if (!chord && !FUNCTION_KEY.test(event.key)) return;
        const accelerator = acceleratorFromKey(event.nativeEvent, platform);
        if (accelerator) onDone(accelerator, true);
      }}
    />
  );
}
