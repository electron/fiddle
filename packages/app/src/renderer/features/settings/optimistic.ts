/**
 * Optimistic settings changes (REQUIREMENTS §3). A change is shown at once as
 * a pending entry on top of the `App` store value. Main answers with the
 * store `rev` that includes it; once the received store reaches that rev,
 * the entry is dropped, so a stale push never overwrites a pending value.
 */
import type { SettingKey, Settings } from '../../../shared/settings';

export interface PendingChange {
  id: number;
  key: SettingKey;
  value: unknown;
  /** Set when main has applied the change. */
  rev?: number;
}

/** Entries the store hasn't caught up with yet. */
export function outstanding(pending: readonly PendingChange[], storeRev: number): PendingChange[] {
  return pending.filter((change) => change.rev === undefined || change.rev > storeRev);
}

/** The store's settings with outstanding changes replayed in order. */
export function withPending(
  settings: Settings,
  pending: readonly PendingChange[],
  storeRev: number,
): Settings {
  const replay = outstanding(pending, storeRev);
  if (replay.length === 0) return settings;
  const next: Record<string, unknown> = { ...settings };
  for (const change of replay) next[change.key] = change.value;
  return next as Settings;
}
