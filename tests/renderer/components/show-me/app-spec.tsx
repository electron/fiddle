import * as React from 'react';

import { mount } from 'enzyme';

import { ShowMeApp as ShowMeAppType } from '../../../../src/renderer/components/show-me/app';

describe('getSubsetOnly()', () => {
  let ShowMeApp: typeof ShowMeAppType;

  beforeAll(async () => {
    jest.useFakeTimers();

    ({ ShowMeApp } = await import('../../../../src/renderer/components/show-me/app'));
  });
  afterAll(() => jest.useRealTimers());

  it('renders', () => {
    const mockState = {};
    const wrapper = mount(<ShowMeApp appState={mockState} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles the focus example', async () => {
    const mockState = {};
    const wrapper = mount(<ShowMeApp appState={mockState} />);

    wrapper.find('button#focus').simulate('click');
    jest.runAllTimers();
    jest.advanceTimersByTime(10000);
  });
});
