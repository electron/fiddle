import * as electron from 'electron';
import * as React from 'react';

import { act } from 'react-dom/test-utils';

import { mount } from 'enzyme';

import { ShowMeApp as ShowMeAppType } from '../../../../src/renderer/components/show-me/app';
import { overridePlatform, resetPlatform } from '../../../utils';

describe('getSubsetOnly()', () => {
  let ShowMeApp: typeof ShowMeAppType;

  beforeAll(async () => {
    jest.useFakeTimers();
    overridePlatform('darwin');

    ({
      ShowMeApp,
    } = require('../../../../src/renderer/components/show-me/app'));
  });

  afterAll(() => {
    jest.useRealTimers();
    resetPlatform();
  });

  it('renders', () => {
    const wrapper = mount(<ShowMeApp />);
    expect(wrapper).toMatchSnapshot();
  });

  it('does not render the show/hide on non-darwin', async () => {
    overridePlatform('win32');

    const wrapper = mount(<ShowMeApp />);
    const element = wrapper.find('button#show-hide');

    expect(element.length).toBe(0);

    overridePlatform('darwin');
  });

  it('handles the show/hide example', async () => {
    const wrapper = mount(<ShowMeApp />);

    wrapper.find('button#show-hide').simulate('click');

    expect(setTimeout).toHaveBeenCalledTimes(1);

    for (const [method] of (setTimeout as any).mock.calls) {
      act(method);
    }

    expect(electron.remote.app.show).toHaveBeenCalled();
    expect(electron.remote.app.hide).toHaveBeenCalled();
  });

  it('handles the focus example', async () => {
    const wrapper = mount(<ShowMeApp />);

    wrapper.find('button#focus').simulate('click');

    expect(setTimeout).toHaveBeenCalledTimes(3);

    for (const [method] of (setTimeout as any).mock.calls) {
      act(method);
    }

    expect(electron.remote.app.focus).toHaveBeenCalled();
  });

  it('handles the paths example', () => {
    (electron.remote.app.getPath as jest.Mock).mockImplementation(
      (name) => name,
    );
    const wrapper = mount(<ShowMeApp />);

    wrapper.find('button#special-paths').simulate('click');
    const specialPaths = wrapper
      .find('pre#special-paths-content')
      .text()
      .trim();

    expect(specialPaths).toEqual(
      `
home: home
appData: appData
userData: ${electron.app.getPath('userData')}
temp: temp
downloads: downloads
desktop: desktop`.trim(),
    );
  });

  it('handles the metrics example', () => {
    (electron.remote.app.getAppMetrics as jest.Mock).mockReturnValue({
      metrics: 123,
    });

    const wrapper = mount(<ShowMeApp />);

    wrapper.find('button#process-metrics').simulate('click');
    const specialPaths = wrapper
      .find('pre#process-metrics-content')
      .text()
      .trim();

    expect(JSON.parse(specialPaths)).toEqual({ metrics: 123 });
  });
});
