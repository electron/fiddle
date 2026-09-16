/**
 * Dragging an editor tab: along the tab row to reorder it, or onto an editor
 * pane to show its file there or in a new pane beside it. The tab carries its
 * file name under `TAB_DRAG_TYPE`; `useTabDrag()` gives that name while such
 * a drag is under way.
 */
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
    window.addEventListener('dragstart', onStart);
    window.addEventListener('dragend', onEnd);
    window.addEventListener('drop', onEnd);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('dragstart', onStart);
      window.removeEventListener('dragend', onEnd);
      window.removeEventListener('drop', onEnd);
    };
  }, []);
  return dragging;
}
