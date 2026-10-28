import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toasts = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('../ui', () => ({ showToast: toasts.showToast }));

import { FiddleError } from '../shared/errors';
import { createOptimistic } from './optimistic';

interface Doc {
  rev: number;
  n: number;
}

function setup(initial: Doc = { rev: 1, n: 0 }) {
  const optimistic = createOptimistic<Doc>();
  const shown: Array<Doc | null> = [];
  let base: Doc | null = initial;
  function Reader() {
    shown.push(optimistic.use(base, base?.rev ?? 0));
    return null;
  }
  const view = render(<Reader />);
  const push = (next: Doc | null) => {
    base = next;
    view.rerender(<Reader />);
  };
  return { optimistic, push, latest: () => shown.at(-1) };
}

afterEach(() => vi.clearAllMocks());

describe('createOptimistic', () => {
  it('shows a change at once and keeps it until the store reaches the rev main answered with', async () => {
    const { optimistic, push, latest } = setup();
    const add = (by: number) => (doc: Doc) => ({ ...doc, n: doc.n + by });
    let answer!: (rev: number) => void;
    const sent = optimistic.change(
      add(1),
      () => new Promise((resolve) => (answer = resolve)),
      'failed',
    );
    await vi.waitFor(() => expect(latest()?.n).toBe(1));

    await act(async () => {
      answer(3);
      await sent;
    });
    // A push from before the change can't undo it.
    push({ rev: 2, n: 0 });
    expect(latest()?.n).toBe(1);
    // Once the store includes it, the store's value wins.
    push({ rev: 3, n: 1 });
    expect(latest()).toEqual({ rev: 3, n: 1 });
    push({ rev: 4, n: 1 });
    expect(latest()).toEqual({ rev: 4, n: 1 });
  });

  it('replays changes in the order they were made', async () => {
    const { optimistic, latest } = setup();
    const never = () => new Promise<number>(() => undefined);
    void optimistic.change((doc) => ({ ...doc, n: 1 }), never, 'failed');
    void optimistic.change((doc) => ({ ...doc, n: doc.n * 10 + 2 }), never, 'failed');
    await vi.waitFor(() => expect(latest()?.n).toBe(12));
  });

  it('drops a rejected change and shows why', async () => {
    const { optimistic, latest } = setup();
    let reject!: (error: unknown) => void;
    const result = optimistic.change(
      (doc) => ({ ...doc, n: 5 }),
      () => new Promise((_resolve, fail) => (reject = fail)),
      'Could not change it',
    );
    await vi.waitFor(() => expect(latest()?.n).toBe(5));
    await act(async () => {
      reject(new FiddleError('invalid-argument', 'not allowed'));
      expect(await result).toBe(false);
    });
    expect(latest()?.n).toBe(0);
    expect(toasts.showToast).toHaveBeenCalledWith({
      tone: 'error',
      title: 'Could not change it',
      description: 'not allowed',
    });
  });
});
