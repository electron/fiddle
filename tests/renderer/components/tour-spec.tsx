import * as React from 'react';
import { shallow } from 'enzyme';

import { Tour } from '../../../src/renderer/components/tour';

describe('VersionChooser component', () => {
  const oldQuerySelector = document.querySelector;
  const mockTour = new Set([
    {
      name: 'mock-step-1',
      selector: 'div.mock-1',
      content: (
        <span>mock-step-1</span>
      )
    },
    {
      name: 'mock-step-2',
      selector: 'div.mock-2',
      content: (
        <span>mock-step-2</span>
      )
    }
  ]);

  beforeEach(() => {
    document.querySelector = jest.fn(() => ({
      getBoundingClientRect: jest.fn(() => ({
        top: 20, left: 25, height: 120, width: 130
      }))
    }));
  });

  afterEach(() => {
    document.querySelector = oldQuerySelector;
  });

  it('renders', () => {
    const mockStop = jest.fn();
    const wrapper = shallow(<Tour tour={mockTour} onStop={mockStop} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('renders custom buttons', () => {
    const mockStop = jest.fn();
    const btnTour = new Set([
      {
        name: 'mock-step-1',
        selector: 'div.mock-1',
        content: (
          <span>mock-step-1</span>
        ),
        getButtons: () => [ (<span>hi</span>) ]
      }
    ]);

    const wrapper = shallow(<Tour tour={btnTour} onStop={mockStop} />);
    expect(wrapper.html().includes('<span>hi</span>')).toBe(true);
  });

  it('stops on stop()', () => {
    const mockStop = jest.fn();
    const wrapper = shallow(<Tour tour={mockTour} onStop={mockStop} />);
    const instance: any = wrapper.instance();

    instance.stop();

    expect(mockStop).toHaveBeenCalled();
  });

  it('advances on advance()', () => {
    const mockStop = jest.fn();
    const wrapper = shallow(<Tour tour={mockTour} onStop={mockStop} />);
    const instance: any = wrapper.instance();

    instance.advance();
    expect((wrapper.state('step') as any).name).toBe('mock-step-2');

    instance.advance();
    expect(wrapper.state('step')).toBe(null);
  });

  it('handles a resize', () => {
    const oldTimeout = window.setTimeout;
    window.setTimeout = (fn: any) => {
      fn();
      return 1;
    };

    const mockStop = jest.fn();
    const wrapper = shallow(<Tour tour={mockTour} onStop={mockStop} />);
    const instance: any = wrapper.instance();

    instance.forceUpdate = jest.fn();
    instance.onResize();

    expect(instance.resizeHandle).toBeTruthy();
    expect(instance.forceUpdate).toHaveBeenCalled();

    window.setTimeout = oldTimeout;
  });
});
