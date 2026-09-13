import { describe, expect, it } from 'vitest';

import {
  countByFile,
  getRuntimeErrors,
  revealLocation,
  setRuntimeErrors,
  splitErrorMessage,
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

  it('counts errors per file', () => {
    const counts = countByFile([error('a.js'), error('b.js'), error('a.js', 3)]);
    expect(counts.get('a.js')).toBe(2);
    expect(counts.get('b.js')).toBe(1);
    expect(counts.get('c.js')).toBeUndefined();
  });

  it('splits the error type from the message', () => {
    expect(splitErrorMessage("Uncaught TypeError: Cannot read properties of undefined (reading 'x')")).toEqual({
      title: 'TypeError',
      text: "Cannot read properties of undefined (reading 'x')",
    });
    expect(splitErrorMessage('ReferenceError: foo is not defined').title).toBe('ReferenceError');
    expect(splitErrorMessage('something broke')).toEqual({ title: null, text: 'something broke' });
  });

  it('accepts reveal requests', () => {
    expect(() => revealLocation('renderer.js', 4, 36)).not.toThrow();
  });
});
