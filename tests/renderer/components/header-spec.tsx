import * as React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Header } from '../../../src/renderer/components/header';
import { AppState } from '../../../src/renderer/state';

vi.mock('../../../src/renderer/components/commands', () => ({
  Commands: () => <div data-testid="commands" />,
}));

vi.mock('../../../src/renderer/components/output', () => ({
  Output: () => <div data-testid="output" />,
}));

vi.mock('../../../src/renderer/components/tour-welcome', () => ({
  WelcomeTour: () => <div data-testid="welcome-tour" />,
}));

describe('Header component', () => {
  const store = {} as AppState;

  it('renders', () => {
    render(<Header appState={store} />);

    expect(screen.getByTestId('commands')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-tour')).toBeInTheDocument();
  });
});
