import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tree, TreeRow } from './Tree';

describe('Tree', () => {
  it('marks the selected row and selects another on click', () => {
    const onChange = vi.fn();
    render(
      <Tree aria-label="Renderer files" value="html" onChange={onChange}>
        <TreeRow id="html" label="index.html" />
        <TreeRow id="renderer" label="renderer.js" pill="1 error" />
      </Tree>,
    );
    const row = (name: RegExp) => screen.getByRole('row', { name });
    expect(row(/index\.html/).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(row(/renderer\.js/));
    expect(onChange).toHaveBeenLastCalledWith('renderer');
  });
});
