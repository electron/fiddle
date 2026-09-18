import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  claimReveal,
  getRuntimeErrors,
  revealLocation,
  setRuntimeErrors,
  splitErrorMessage,
  useRevealRequest,
  type RuntimeError,
} from './runtime-errors';

const error = (file: string, line = 1): RuntimeError => ({
  file,
  line,
  column: 1,
  message: 'TypeError: nope',
  process: 'renderer',
});

describe('runtime errors', () => {
  it('stores and clears errors', () => {
    setRuntimeErrors([error('renderer.js')]);
    expect(getRuntimeErrors()).toHaveLength(1);
    setRuntimeErrors([]);
    expect(getRuntimeErrors()).toEqual([]);
  });

  it('splits the error type from the message', () => {
    expect(
      splitErrorMessage(
        "Uncaught TypeError: Cannot read properties of undefined (reading 'x')",
      ),
    ).toEqual({
      title: 'TypeError',
      text: "Cannot read properties of undefined (reading 'x')",
    });
    expect(splitErrorMessage('ReferenceError: foo is not defined').title).toBe(
      'ReferenceError',
    );
    expect(splitErrorMessage('something broke')).toEqual({
      title: null,
      text: 'something broke',
    });
  });

  it('lets one pane act on each reveal request', () => {
    const requests: ReturnType<typeof useRevealRequest>[] = [];
    function Reader() {
      requests.push(useRevealRequest());
      return null;
    }
    render(<Reader />);
    const latest = () => requests.at(-1)!;
    act(() => revealLocation('renderer.js', 4, 36));
    expect(latest()).toMatchObject({ file: 'renderer.js', line: 4, column: 36 });
    const seq = latest().seq;
    expect(claimReveal(seq)).toBe(true);
    // A pane mounted afterwards sees the old request and must not replay it.
    expect(claimReveal(seq)).toBe(false);
    act(() => revealLocation('renderer.js', 4, 36));
    expect(claimReveal(latest().seq)).toBe(true);
  });
});
