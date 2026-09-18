import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, IconButton } from './Button';
import { ToolbarButton, ToolbarCapsule } from './Toolbar';

describe('Button', () => {
  it('calls onPress when clicked', () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Run</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onPress from the keyboard', () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Run</Button>);
    const button = screen.getByRole('button', { name: 'Run' });
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter' });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses when disabled', () => {
    const onPress = vi.fn();
    render(
      <Button onPress={onPress} isDisabled>
        Publish
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows the key-cap hint, and hides it while loading', () => {
    const onPress = vi.fn();
    const { rerender } = render(
      <Button kbd="⌘R" onPress={onPress}>
        Run
      </Button>,
    );
    expect(screen.getByText('⌘R')).toBeTruthy();
    rerender(
      <Button kbd="⌘R" loading onPress={onPress}>
        Starting
      </Button>,
    );
    expect(screen.queryByText('⌘R')).toBeNull();
    // Still focusable while pending, but presses are ignored.
    const button = screen.getByRole('button', { name: 'Starting' });
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reflects a toggled state with aria-pressed', () => {
    render(<Button isPressed>Console</Button>);
    expect(
      screen.getByRole('button', { name: 'Console' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('IconButton', () => {
  it('is named by its label and presses', () => {
    const onPress = vi.fn();
    render(<IconButton icon="settings" label="Settings" onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses when disabled', () => {
    const onPress = vi.fn();
    render(<IconButton icon="trash" label="Delete" onPress={onPress} isDisabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Toolbar', () => {
  it('groups controls and names icon-only toolbar buttons', () => {
    const onPress = vi.fn();
    render(
      <ToolbarCapsule label="Run controls">
        <Button variant="primary">Run</Button>
        <ToolbarButton icon="settings" label="Settings" onPress={onPress} />
      </ToolbarCapsule>,
    );
    expect(screen.getByRole('group', { name: 'Run controls' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
