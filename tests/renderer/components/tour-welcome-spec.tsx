import * as React from 'react';
import { shallow } from 'enzyme';

import { WelcomeTour } from '../../../src/renderer/components/tour-welcome';

describe('Header component', () => {
  beforeEach(() => {
    this.store = {
      isTourShowing: true,
      disableTour: jest.fn()
    };
  });

  it('renders', () => {
    const wrapper = shallow(<WelcomeTour appState={this.store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the tour once started', () => {
    const wrapper = shallow(<WelcomeTour appState={this.store} />);
    const instance: WelcomeTour = wrapper.instance() as any;

    instance.startTour();

    expect(wrapper.state('isTourStarted')).toBe(true);
    expect(wrapper).toMatchSnapshot();
  });

  it('stops the tour on stopTour()', () => {
    const wrapper = shallow(<WelcomeTour appState={this.store} />);
    const instance: WelcomeTour = wrapper.instance() as any;

    instance.stopTour();

    expect(wrapper.state('isTourStarted')).toBe(false);
    expect(this.store.disableTour).toHaveBeenCalled();
  });
});
