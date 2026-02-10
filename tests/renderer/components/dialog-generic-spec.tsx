import * as React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { GenericDialogType } from '../../../src/interfaces';
import { GenericDialog } from '../../../src/renderer/components/dialog-generic';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform } from '../../utils';

describe('GenericDialog component', () => {
  let store: AppState;

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
  });

  describe('renders', () => {
    function renderDialogWithType(type: GenericDialogType) {
      store.genericDialogOptions.type = type;
      store.genericDialogOptions.ok = 'Okay';
      store.genericDialogOptions.label = 'Test label';
      store.isGenericDialogShowing = true;
      return render(<GenericDialog appState={store} />);
    }

    it('warning', () => {
      renderDialogWithType(GenericDialogType.warning);
      expect(screen.getByText('Test label')).toBeInTheDocument();
      expect(screen.getByText('Okay')).toBeInTheDocument();
    });

    it('confirmation', () => {
      renderDialogWithType(GenericDialogType.confirm);
      expect(screen.getByText('Test label')).toBeInTheDocument();
      expect(screen.getByText('Okay')).toBeInTheDocument();
    });

    it('success', () => {
      renderDialogWithType(GenericDialogType.success);
      expect(screen.getByText('Test label')).toBeInTheDocument();
      expect(screen.getByText('Okay')).toBeInTheDocument();
    });

    it('with an input prompt', () => {
      store.genericDialogOptions.wantsInput = true;
      renderDialogWithType(GenericDialogType.confirm);
      expect(screen.getByText('Test label')).toBeInTheDocument();
      // The InputGroup renders an input element with id="input"
      expect(document.getElementById('input')).toBeInTheDocument();
    });

    it('with an input prompt and placeholder', () => {
      store.genericDialogOptions.wantsInput = true;
      store.genericDialogOptions.placeholder = 'placeholder';
      renderDialogWithType(GenericDialogType.confirm);
      expect(screen.getByText('Test label')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('placeholder')).toBeInTheDocument();
    });
  });

  it('onClose() closes itself', async () => {
    const user = userEvent.setup();
    store.isGenericDialogShowing = true;
    store.genericDialogOptions.ok = 'Okay';
    store.genericDialogOptions.cancel = 'Cancel';
    store.genericDialogOptions.label = 'Test label';
    render(<GenericDialog appState={store} />);

    // Click the confirm button to trigger onClose(true)
    await user.click(screen.getByText('Okay'));
    expect(store.isGenericDialogShowing).toBe(false);
  });

  it('enter submit', async () => {
    const user = userEvent.setup();
    store.isGenericDialogShowing = true;
    store.genericDialogOptions.ok = 'Okay';
    store.genericDialogOptions.label = 'Test label';
    store.genericDialogOptions.wantsInput = true;
    render(<GenericDialog appState={store} />);

    const input = document.getElementById('input') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    // Focus the input and press Enter
    input.focus();
    await user.keyboard('{Enter}');

    expect(store.isGenericDialogShowing).toBe(false);
  });
});
