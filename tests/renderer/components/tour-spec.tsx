import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { Tour } from '../../../src/renderer/components/tour';
import { overridePlatform, resetPlatform } from '../../utils';


describe('VersionChooser component', () => {
  const oldQuerySelector = document.querySelector;
  const mockTour = new Set([
    {
      name: 'mock-step-1',
      selector: 'div.mock-1',
      title: 'Step 1',
      content: (
        <span key='1'>mock-step-1</span>
      )
    },
    {
      name: 'mock-step-2',
      selector: 'div.mock-2',
      title: 'Step 2',
      content: (
        <span key='2'>mock-step-2</span>
      )
    }
  ]);

  beforeAll(() => {
    overridePlatform('darwin');
  });

  afterAll(() => {
    resetPlatform();
  });

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

  it('renders supplied buttons', () => {
    mockTour.forEach((item) => {
      (item as any).getButtons = () => (
        [ <button key='hello'>Hello</button> ]
      );
    });

    const mockStop = jest.fn();
    const wrapper = shallow(<Tour tour={mockTour} onStop={mockStop} />);

    expect(wrapper.find('button').text()).toBe('Hello');
  });

  it('renders "Finish Tour" at the end', () => {
    const singleItemTour = new Set([{
      name: 'mock-step-1',
      selector: 'div.mock-1',
      title: 'Step 1',
      content: (
        <span key='1'>mock-step-1</span>
      )
    }]);

    const mockStop = jest.fn();
    const wrapper = mount(<Tour tour={singleItemTour} onStop={mockStop} />);

    expect(wrapper.find('button').text()).toBe('tick-circleFinish Tour');
  });

  it('handles a missing target', () => {
    (document.querySelector as jest.Mock).mockReturnValueOnce(null);

    const mockStop = jest.fn();
    const wrapper = shallow(<Tour tour={mockTour} onStop={mockStop} />);

    expect(wrapper.find('svg').length).toBe(1);
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
    jest.useFakeTimers();

    const mockStop = jest.fn();
    const wrapper = shallow(<Tour tour={mockTour} onStop={mockStop} />);
    const instance: any = wrapper.instance();

    instance.forceUpdate = jest.fn();
    instance.onResize();


    expect(instance.resizeHandle).toBeTruthy();
    jest.runAllTimers();

    expect(instance.forceUpdate).toHaveBeenCalled();
  });

  it('removes the resize listener', () => {
    const oldRemove = window.removeEventListener;
    window.removeEventListener = jest.fn();

    const mockStop = jest.fn();
    const wrapper = shallow(<Tour tour={mockTour} onStop={mockStop} />);
    const instance: Tour = wrapper.instance() as any;

    instance.componentWillUnmount();
    expect(window.removeEventListener).toHaveBeenCalled();

    window.removeEventListener = oldRemove;
  });
});
