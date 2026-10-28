import { useEffect, useState } from 'react';

/** Lower case: `DataTransfer.types` lower-cases custom types. */
export const TAB_DRAG_TYPE = 'application/x-fiddle-tab';

export function isTabDrag(data: Pick<DataTransfer, 'types'> | null | undefined): boolean {
  return data?.types.includes(TAB_DRAG_TYPE) ?? false;
}

/** The dragged tab's file name, from its `dragstart` until its `dragend`; otherwise null. */
export function useTabDrag(): string | null {
  const [dragging, setDragging] = useState<string | null>(null);
  useEffect(() => {
    const listeners = new AbortController();
    const { signal } = listeners;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onStart = (event: DragEvent) => {
      if (!isTabDrag(event.dataTransfer)) return;
      // The tab set its data first (the event bubbles up from it), and `dragstart` may still read it.
      const name = event.dataTransfer?.getData(TAB_DRAG_TYPE);
      if (!name) return;
      // Chromium cancels a drag whose page changes during `dragstart`.
      timer = setTimeout(() => setDragging(name));
    };
    const onEnd = () => {
      clearTimeout(timer);
      setDragging(null);
    };
    window.addEventListener('dragstart', onStart, { signal });
    window.addEventListener('dragend', onEnd, { signal });
    window.addEventListener('drop', onEnd, { signal });
    return () => {
      clearTimeout(timer);
      listeners.abort();
    };
  }, []);
  return dragging;
}
