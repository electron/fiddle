import * as React from 'react';

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { BlockableAccelerator } from '../../../src/interfaces';
import { BlockAcceleratorsSettings } from '../../../src/renderer/components/settings-general-block-accelerators';
import { AppState } from '../../../src/renderer/state';

describe('BlockAcceleratorsSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('renders', () => {
    const { container } = render(
      <BlockAcceleratorsSettings appState={store} />,
    );
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Block Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByLabelText('Save')).toBeInTheDocument();
    expect(screen.getByLabelText('Save as')).toBeInTheDocument();
  });

  describe('handleBlockAcceleratorChange()', () => {
    it('handles a new selection', async () => {
      const user = userEvent.setup();

      // Start with the accelerator not blocked (unchecked)
      store.acceleratorsToBlock = [];
      const { rerender } = render(
        <BlockAcceleratorsSettings appState={store} />,
      );

      const saveCheckbox = screen.getByLabelText('Save');

      // Click to check: should call addAcceleratorToBlock
      await user.click(saveCheckbox);
      expect(store.addAcceleratorToBlock).toHaveBeenCalledWith(
        BlockableAccelerator.save,
      );

      // Now simulate the accelerator being blocked (checked)
      store.acceleratorsToBlock = [BlockableAccelerator.save];
      rerender(<BlockAcceleratorsSettings appState={store} />);

      // Click to uncheck: should call removeAcceleratorToBlock
      await user.click(screen.getByLabelText('Save'));
      expect(store.removeAcceleratorToBlock).toHaveBeenCalledWith(
        BlockableAccelerator.save,
      );
    });
  });
});
