import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mergeDiagnostics, setEditorMarkers, useBadges } from './diagnostics';

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
    const { result } = renderHook(useBadges);
    act(() =>
      setEditorMarkers([
        { file: 'a.js', severity: 'error' },
        { file: 'a.js', severity: 'error' },
        { file: 'a.js', severity: 'warning' },
        { file: 'b.js', severity: 'warning' },
      ]),
    );
    // Without an i18next instance, `t` returns the key.
    expect(result.current('a.js')).toEqual({ count: 2, tone: 'error', label: 'errorCount' });
    expect(result.current('b.js')).toEqual({ count: 1, tone: 'warning', label: 'warningCount' });
    expect(result.current('c.js')).toBeUndefined();
    act(() => setEditorMarkers([]));
  });
});
