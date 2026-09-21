/** List: single selection by click, reported by row id. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { List, ListRow } from './Content';

function option(name: RegExp) {
  return screen.getByRole('option', { name });
}

describe('List', () => {
  it('reports the clicked row by id and shows the controlled value as selected', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <List aria-label="Revisions" value={null} onChange={onChange}>
        <ListRow id="abc" title="Revision 2" meta="abc1234" />
        <ListRow id="def" title="Created" />
      </List>,
    );
    expect(screen.getByRole('listbox', { name: 'Revisions' })).toBeTruthy();
    fireEvent.click(option(/Revision 2/));
    expect(onChange).toHaveBeenCalledWith('abc');
    // Controlled: nothing shows selected until the value comes back.
    expect(option(/Revision 2/).getAttribute('aria-selected')).toBe('false');
    rerender(
      <List aria-label="Revisions" value="abc" onChange={onChange}>
        <ListRow id="abc" title="Revision 2" meta="abc1234" />
        <ListRow id="def" title="Created" />
      </List>,
    );
    expect(option(/Revision 2/).getAttribute('aria-selected')).toBe('true');
  });
});
