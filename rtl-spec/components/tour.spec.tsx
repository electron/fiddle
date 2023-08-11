import * as React from 'react';

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mocked } from 'jest-mock';

import { Tour, TourScriptStep } from '../../src/renderer/components/tour';
import { overrideRendererPlatform } from '../../tests/utils';

describe('VersionChooser component', () => {
  const oldQuerySelector = document.querySelector;

  /**
   * This is a function to ensure different object references are returned every
   * time. The test for the `getButtons` method mutates the mock tour and that
   * would interfere with other tests if the same object were reused.
   */
  const getMockTour = () =>
    new Set<TourScriptStep>([
      {
        name: 'mock-step-1',
        selector: 'div.mock-1',
        title: 'Step 1',
        content: <span key="1">mock-step-1</span>,
      },
      {
        name: 'mock-step-2',
        selector: 'div.mock-2',
        title: 'Step 2',
        content: <span key="2">mock-step-2</span>,
      },
    ]);

  const mockStop = jest.fn();

  function renderTour(mockTour = getMockTour()) {
    return render(<Tour tour={mockTour} onStop={mockStop} />);
  }

  beforeEach(() => {
    overrideRendererPlatform('darwin');

    document.querySelector = jest.fn(() => ({
      getBoundingClientRect: jest.fn(() => ({
        top: 20,
        left: 25,
        height: 120,
        width: 130,
      })),
    }));
  });

  afterEach(() => {
    document.querySelector = oldQuerySelector;
  });

  it('renders', () => {
    const { getByTestId } = renderTour();

    expect(getByTestId('tour')).toBeInTheDocument();
  });

  it('renders supplied buttons', () => {
    const mockTour = getMockTour();

    mockTour.forEach((item) => {
      (item as any).getButtons = () => [<button key="hello">Hello</button>];
    });

    const { getByText } = renderTour(mockTour);

    expect(getByText(/hello/i)).toBeInTheDocument();
  });

  it(`renders the "Finish Tour" button at the end and closes the tour when it's clicked`, async () => {
    const singleItemTour = new Set([
      {
        name: 'mock-step-1',
        selector: 'div.mock-1',
        title: 'Step 1',
        content: <span key="1">mock-step-1</span>,
      },
    ]);

    const { getByText } = renderTour(singleItemTour);
    const finishTourButton = getByText(/finish tour/i);

    expect(finishTourButton).toBeInTheDocument();

    await userEvent.click(finishTourButton);

    expect(mockStop).toHaveBeenCalled();
  });

  it('handles a missing target', () => {
    mocked(document.querySelector).mockReturnValueOnce(null);

    const { container } = renderTour();

    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('stops on stop()', async () => {
    const { getByText } = renderTour();

    await userEvent.click(getByText(/stop tour/i));

    expect(mockStop).toHaveBeenCalled();
  });

  it('advances on advance()', async () => {
    const { getByText } = renderTour();

    await userEvent.click(getByText(/continue/i));

    const mockTour = [...getMockTour()];

    expect(getByText(mockTour[1].title)).toBeInTheDocument();
  });
});
