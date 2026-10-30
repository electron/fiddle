import { useEffect, useRef, useState } from 'react';

import { useLatest } from '../hooks';

/** Continuous input (a splitter drag) stays local and is committed once it settles. The commit is optimistic, so dropping the draft after it doesn't flicker. */
export function useDraft(
  value: number,
  commit: (value: number) => void,
  delay = 250,
): [number, (value: number) => void] {
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitRef = useLatest(commit);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (next: number) => {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      commitRef.current(next);
      setDraft(null);
    }, delay);
  };
  return [draft ?? value, change];
}
