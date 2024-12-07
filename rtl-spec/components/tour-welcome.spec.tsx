import * as React from 'react';

import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import {
  WelcomeTour,
  getWelcomeTour,
} from '../../src/renderer/components/tour-welcome';
import { AppState } from '../../src/renderer/state';

describe('Header component', () => {
  let appState: AppState;

  function renderWelcomeTour(appState: AppState) {
    return render(<WelcomeTour appState={appState} />);
  }

  beforeEach(() => {
    ({ state: appState } = window.app);
    appState.isTourShowing = true;
  });

  it('renders', () => {
    const { getByTestId } = renderWelcomeTour(appState);
    expect(getByTestId('welcome-tour-dialog')).toBeInTheDocument();
  });

  it('does not render if the tour is not showing', () => {
    appState.isTourShowing = false;

    const { queryByTestId } = renderWelcomeTour(appState);
    expect(queryByTestId('welcome-tour-dialog')).not.toBeInTheDocument();
  });

  it('renders the tour once started', async () => {
    const { getByText, getByTestId } = renderWelcomeTour(appState);

    await userEvent.click(getByText(/show me around/i));

    expect(getByTestId('tour')).toBeInTheDocument();
  });

  it('stops the tour on stopTour()', async () => {
    (appState.disableTour as jest.Mock).mockImplementation(
      () => (appState.isTourShowing = false),
    );

    const { getByText, queryByTestId } = renderWelcomeTour(appState);

    await userEvent.click(getByText(/show me around/i));
    await userEvent.click(getByText(/stop tour/i));

    expect(appState.isTourShowing).toBe(false);

    expect(queryByTestId('tour')).not.toBeInTheDocument();

    expect(appState.disableTour).toHaveBeenCalled();
  });

  describe('getWelcomeTour()', () => {
    it('offers custom buttons for the Electron step', async () => {
      const tourSteps = [...getWelcomeTour()];
      const electronStep = tourSteps.find(
        ({ name }) => name === 'first-time-electron',
      );
      const mockParam = { stop: jest.fn(), advance: jest.fn() };
      const buttons = electronStep!.getButtons!(mockParam);

      const renderResultFirstButton = render(buttons[0]);
      await userEvent.click(renderResultFirstButton.getByText(/i'm good!/i));

      expect(mockParam.stop).toHaveBeenCalled();

      const renderResultSecondButton = render(buttons[1]);
      await userEvent.click(
        renderResultSecondButton.getByText(/electron basics/i),
      );

      expect(mockParam.advance).toHaveBeenCalled();
    });
  });
});
