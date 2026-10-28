import type { ReleaseRow } from '../../shared/stores';

/** A supported, current release row. */
export const row = (version: string, extra: Partial<ReleaseRow> = {}): ReleaseRow => ({
  version,
  date: '',
  node: '',
  obsolete: false,
  supported: true,
  ...extra,
});
