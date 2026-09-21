import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tree, TreeRow } from './Tree';

function row(name: RegExp) {
  return screen.getByRole('row', { name });
}

describe('Tree', () => {
  it('selects a row on click', () => {
    const onChange = vi.fn();
    render(
      <Tree aria-label="Renderer files" value={null} onChange={onChange}>
        <TreeRow id="html" label="index.html" />
        <TreeRow id="renderer" label="renderer.js" pill="1 error" />
      </Tree>,
    );
    fireEvent.click(row(/renderer\.js/));
    expect(onChange).toHaveBeenLastCalledWith('renderer');
  });

  it('moves between rows with arrow keys', () => {
    render(
      <Tree aria-label="Renderer files" value="html" onChange={() => {}}>
        <TreeRow id="html" label="index.html" />
        <TreeRow id="renderer" label="renderer.js" />
      </Tree>,
    );
    expect(row(/index\.html/).getAttribute('aria-selected')).toBe('true');
    act(() => row(/index\.html/).focus());
    fireEvent.keyDown(row(/index\.html/), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row(/renderer\.js/));
  });
});
