import { shallow } from 'enzyme';
import * as React from 'react';

import {
  getWelcomeTour,
  WelcomeTour,
} from '../../../src/renderer/components/tour-welcome';
import { ipcRendererManager } from '../../../src/renderer/ipc';

describe('Header component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      isTourShowing: true,
      disableTour: jest.fn(),
    };

    ipcRendererManager.removeAllListeners();
  });

  it('renders', () => {
    const wrapper = shallow(<WelcomeTour appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders null if the tour is not showing', () => {
    store.isTourShowing = false;

    const wrapper = shallow(<WelcomeTour appState={store} />);
    expect(wrapper.html()).toBe(null);
  });

  it('renders the tour once started', () => {
    const wrapper = shallow(<WelcomeTour appState={store} />);
    const instance: WelcomeTour = wrapper.instance() as any;

    instance.startTour();

    expect(wrapper.state('isTourStarted')).toBe(true);
    expect(wrapper).toMatchSnapshot();
  });

  it('stops the tour on stopTour()', () => {
    const wrapper = shallow(<WelcomeTour appState={store} />);
    const instance: WelcomeTour = wrapper.instance() as any;

    instance.stopTour();

    expect(wrapper.state('isTourStarted')).toBe(false);
    expect(store.disableTour).toHaveBeenCalled();
  });

  describe('getWelcomeTour()', () => {
    it('offers custom buttons for the Electron step', () => {
      const tourSteps = [...getWelcomeTour()];
      const electronStep = tourSteps.find(
        ({ name }) => name === 'first-time-electron',
      );
      const mockParam = { stop: jest.fn(), advance: jest.fn() };
      const buttons = electronStep!.getButtons!(mockParam);

      shallow(buttons[0]).simulate('click');
      expect(mockParam.stop).toHaveBeenCalled();

      shallow(buttons[1]).simulate('click');
      expect(mockParam.advance).toHaveBeenCalled();
    });
  });
});
