import { describe, expect, it } from 'vitest';

import { badgeOf, mergeDiagnostics } from './diagnostics';

describe('diagnostics', () => {
  it('merges runtime errors with Monaco errors and warnings per file', () => {
    const merged = mergeDiagnostics(
      [{ file: 'renderer.js' }, { file: 'renderer.js' }, { file: 'main.js' }],
      [
        { file: 'main.js', severity: 'error' },
        { file: 'main.js', severity: 'warning' },
        { file: 'styles.css', severity: 'warning' },
      ],
    );
    expect(merged.get('renderer.js')).toEqual({ errors: 2, warnings: 0 });
    expect(merged.get('main.js')).toEqual({ errors: 2, warnings: 1 });
    expect(merged.get('styles.css')).toEqual({ errors: 0, warnings: 1 });
    expect(merged.has('index.html')).toBe(false);
  });

  it('badges errors first, then warnings', () => {
    expect(badgeOf({ errors: 2, warnings: 1 })).toEqual({ count: 2, tone: 'error' });
    expect(badgeOf({ errors: 0, warnings: 3 })).toEqual({ count: 3, tone: 'warning' });
    expect(badgeOf({ errors: 0, warnings: 0 })).toBeNull();
    expect(badgeOf(undefined)).toBeNull();
  });
});
