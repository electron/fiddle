// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SplitHandle } from './SplitHandle';

afterEach(cleanup);

function Harness({ orientation = 'vertical', reverse = false }: { orientation?: 'vertical' | 'horizontal'; reverse?: boolean }) {
  const [value, setValue] = useState(200);
  return (
    <SplitHandle
      orientation={orientation}
      value={value}
      min={100}
      max={300}
      step={10}
      reverse={reverse}
      onChange={setValue}
      onReset={() => setValue(200)}
      label="Resize sidebar"
    />
  );
}

function handle() {
  return screen.getByRole('separator', { name: 'Resize sidebar' });
}

describe('SplitHandle', () => {
  it('exposes its size to assistive tech', () => {
    render(<Harness />);
    expect(handle().getAttribute('aria-valuenow')).toBe('200');
    expect(handle().getAttribute('aria-orientation')).toBe('vertical');
    expect(handle().tabIndex).toBe(0);
  });

  it('resizes with arrow keys and clamps at the limits', () => {
    render(<Harness />);
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(handle().getAttribute('aria-valuenow')).toBe('210');
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    expect(handle().getAttribute('aria-valuenow')).toBe('190');
    fireEvent.keyDown(handle(), { key: 'End' });
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
    fireEvent.keyDown(handle(), { key: 'Home' });
    expect(handle().getAttribute('aria-valuenow')).toBe('100');
  });

  it('grows a pane below it when moved up', () => {
    render(<Harness orientation="horizontal" reverse />);
    fireEvent.keyDown(handle(), { key: 'ArrowUp' });
    expect(handle().getAttribute('aria-valuenow')).toBe('210');
  });

  it('restores the default size on Enter and double-click', () => {
    render(<Harness />);
    fireEvent.keyDown(handle(), { key: 'End' });
    fireEvent.keyDown(handle(), { key: 'Enter' });
    expect(handle().getAttribute('aria-valuenow')).toBe('200');
    fireEvent.keyDown(handle(), { key: 'Home' });
    fireEvent.doubleClick(handle());
    expect(handle().getAttribute('aria-valuenow')).toBe('200');
  });

  it('resizes by dragging', () => {
    render(<Harness />);
    fireEvent.pointerDown(handle(), { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 150 });
    expect(handle().getAttribute('aria-valuenow')).toBe('250');
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 400 });
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
    fireEvent.pointerUp(handle(), { pointerId: 1, clientX: 400 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 0 });
    expect(handle().getAttribute('aria-valuenow')).toBe('300');
  });
});
