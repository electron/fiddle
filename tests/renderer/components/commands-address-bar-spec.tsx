import { shallow } from 'enzyme';
import * as React from 'react';

import { observable } from 'mobx';
import { AddressBar } from '../../../src/renderer/components/commands-address-bar';
import { ElectronFiddleMock } from '../../mocks/electron-fiddle';
import { MockState } from '../../mocks/state';

jest.mock('../../../src/utils/octokit');

describe('AddressBar component', () => {
  let store: any;
  (window as any).ElectronFiddle = new ElectronFiddleMock();

  class MockStore {
    @observable public gistId: string | null = null;
    @observable public isWarningDialogShowing: boolean = false;
    @observable public isConfirmationPromptShowing: boolean = false;
    public setWarningDialogTexts = jest.fn();
    public setConfirmationDialogTexts = jest.fn();
    public setConfirmationPromptTexts = jest.fn();
    public toggleWarningDialog = jest.fn();
  }

  beforeEach(() => {
    store = new MockStore();
  });

  it('renders', () => {
    const wrapper = shallow(<AddressBar appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('uses an existing gistId as state', () => {
    store.gistId = 'hi';

    const wrapper = shallow(<AddressBar appState={store} />);
    expect((wrapper.state() as any).value).toBe('https://gist.github.com/hi');
  });

  it('handles change', () => {
    const wrapper = shallow(<AddressBar appState={store} />);
    const instance: AddressBar = wrapper.instance() as any;
    instance.handleChange({ target: { value: 'hi' } } as any);

    expect(wrapper.state('value')).toBe('hi');
  });

  it('handles an external state change', () => {
    const mockStore = new MockState() as any;
    const wrapper = shallow(<AddressBar appState={mockStore} />);

    mockStore.gistId = 'hi';

    expect((wrapper.state() as any).value).toBe('https://gist.github.com/hi');
  });

  it('handles submit', () => {
    const preventDefault = jest.fn();
    const wrapper = shallow(<AddressBar appState={store} />);
    const instance: AddressBar = wrapper.instance() as any;

    instance.handleChange({ target: { value: 'abcdtestid' } } as any);
    wrapper.find('form').simulate('submit', { preventDefault });

    expect(wrapper.state('value')).toBe('abcdtestid');
    expect(preventDefault).toHaveBeenCalled();
  });

  it('disables during gist publishing', async () => {
    const wrapper = shallow(<AddressBar appState={store} />);

    wrapper.setProps({appState: {...store, isPublishing: true}}, () => {
      expect(wrapper.find('fieldset').prop('disabled')).toBe(true);
    });

    wrapper.setProps({appState: {...store, isPublishing: false}}, () => {
      expect(wrapper.find('fieldset').prop('disabled')).toBe(false);
    });
  });
});
