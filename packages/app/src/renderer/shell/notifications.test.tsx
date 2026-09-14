import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components';
import { describe, expect, it, vi } from 'vitest';

import type { ToastContent } from '../../ui';
import { createToastHistory, HISTORY_LIMIT } from './notifications';

function setup(maxVisibleToasts = 5) {
  const queue = new ToastQueue<ToastContent>({ maxVisibleToasts });
  let clock = 0;
  const history = createToastHistory(queue, () => ++clock);
  return { queue, history };
}

describe('toast history', () => {
  it('records each toast once, newest first, and counts unseen ones', () => {
    const { queue, history } = setup();
    queue.add({ title: 'First' });
    const key = queue.add({ title: 'Second', tone: 'error' });
    queue.close(key);
    const { entries, unseen } = history.getSnapshot();
    expect(entries.map((e) => e.content.title)).toEqual(['Second', 'First']);
    expect(entries[0]?.time).toBeGreaterThan(entries[1]?.time ?? 0);
    expect(unseen).toBe(2);

    history.markSeen();
    expect(history.getSnapshot().unseen).toBe(0);
    expect(history.getSnapshot().entries).toHaveLength(2);
  });

  it('keeps a toast action in the list', () => {
    const { queue, history } = setup();
    const onAction = vi.fn();
    queue.add({ title: 'Published', actionLabel: 'Copy link', onAction });
    const [entry] = history.getSnapshot().entries;
    expect(entry?.content.actionLabel).toBe('Copy link');
    entry?.content.onAction?.();
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('records a toast once, even when a newer one hides it for a while, and keeps at most the limit', () => {
    const { queue, history } = setup(1);
    queue.add({ title: 'A' });
    const second = queue.add({ title: 'B' });
    queue.close(second);
    expect(history.getSnapshot().entries.map((e) => e.content.title)).toEqual(['B', 'A']);
    expect(history.getSnapshot().unseen).toBe(2);

    for (let i = 0; i < HISTORY_LIMIT + 5; i++) queue.close(queue.add({ title: `T${i}` }));
    expect(history.getSnapshot().entries).toHaveLength(HISTORY_LIMIT);
  });

  it('clears the list', () => {
    const { queue, history } = setup();
    queue.add({ title: 'A' });
    history.clear();
    expect(history.getSnapshot()).toEqual({ entries: [], unseen: 0 });
  });
});
