import * as React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { FontSettings } from '../../../src/renderer/components/settings-general-font';
import { AppState } from '../../../src/renderer/state';

describe('FontSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    store = {
      fontSize: undefined,
      fontFamily: undefined,
    } as AppState;
  });

  it('renders', () => {
    const { container } = render(<FontSettings appState={store} />);
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Font Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Font Family')).toBeInTheDocument();
    expect(screen.getByLabelText('Font Size')).toBeInTheDocument();
  });

  describe('handleSetFontFamily()', () => {
    it('handles a new selection', async () => {
      render(<FontSettings appState={store} />);

      const input = screen.getByLabelText('Font Family');

      const CALIBRI = 'Calibri';
      const VERDANA = 'Verdana';

      fireEvent.change(input, { target: { value: CALIBRI } });
      expect(store.fontFamily).toBe(CALIBRI);

      fireEvent.change(input, { target: { value: VERDANA } });
      expect(store.fontFamily).toBe(VERDANA);
    });
  });

  describe('handleSetFontSize()', () => {
    it('handles a new selection', async () => {
      render(<FontSettings appState={store} />);

      const input = screen.getByLabelText('Font Size');

      fireEvent.change(input, { target: { value: '12' } });
      expect(store.fontSize).toBe(12);

      fireEvent.change(input, { target: { value: '10' } });
      expect(store.fontSize).toBe(10);
    });

    it('handles being cleared', async () => {
      render(<FontSettings appState={store} />);

      const input = screen.getByLabelText('Font Size');

      fireEvent.change(input, { target: { value: '' } });
      expect(store.fontSize).toBeUndefined();
    });
  });
});
