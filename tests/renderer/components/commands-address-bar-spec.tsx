import { shallow } from 'enzyme';
import * as React from 'react';

import { AddressBar } from '../../../src/renderer/components/commands-address-bar';
import { GistActionState } from '../../../src/interfaces';
import { urlFromId } from '../../../src/utils/gist';

import { StateMock } from '../../mocks/state';

jest.mock('../../../src/utils/octokit');

describe('AddressBar component', () => {
  let store: StateMock;

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  it('renders', () => {
    const wrapper = shallow(<AddressBar appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('uses an existing gistId as state', () => {
    const gistId = 'hi';
    store.gistId = gistId;

    const wrapper = shallow(<AddressBar appState={store as any} />);
    expect((wrapper.state() as any).value).toBe(urlFromId(gistId));
  });

  it('handles change', () => {
    const wrapper = shallow(<AddressBar appState={store as any} />);
    const instance: AddressBar = wrapper.instance() as any;
    instance.handleChange({ target: { value: 'hi' } } as any);

    expect(wrapper.state('value')).toBe('hi');
  });

  it('handles an external state change', () => {
    const wrapper = shallow(<AddressBar appState={store as any} />);

    const gistId = 'hi';
    store.gistId = gistId;
    expect((wrapper.state() as any).value).toBe(urlFromId(gistId));
  });

  it('handles submit', () => {
    const preventDefault = jest.fn();
    const wrapper = shallow(<AddressBar appState={store as any} />);
    const instance: AddressBar = wrapper.instance() as any;

    instance.handleChange({ target: { value: 'abcdtestid' } } as any);
    wrapper.find('form').simulate('submit', { preventDefault });

    expect(wrapper.state('value')).toBe('abcdtestid');
    expect(preventDefault).toHaveBeenCalled();
  });

  it('disables during gist publishing', async () => {
    const wrapper = shallow(<AddressBar appState={store as any} />);

    wrapper.setProps(
      { appState: { ...store, activeGistAction: GistActionState.publishing } },
      () => {
        expect(wrapper.find('fieldset').prop('disabled')).toBe(true);
      },
    );

    wrapper.setProps(
      { appState: { ...store, activeGistAction: GistActionState.none } },
      () => {
        expect(wrapper.find('fieldset').prop('disabled')).toBe(false);
      },
    );
  });

  it('disables during gist updating', async () => {
    const wrapper = shallow(<AddressBar appState={store as any} />);

    wrapper.setProps(
      { appState: { ...store, activeGistAction: GistActionState.updating } },
      () => {
        expect(wrapper.find('fieldset').prop('disabled')).toBe(true);
      },
    );

    wrapper.setProps(
      { appState: { ...store, activeGistAction: GistActionState.none } },
      () => {
        expect(wrapper.find('fieldset').prop('disabled')).toBe(false);
      },
    );
  });

  it('disables during gist deleting', async () => {
    const wrapper = shallow(<AddressBar appState={store as any} />);

    wrapper.setProps(
      { appState: { ...store, activeGistAction: GistActionState.deleting } },
      () => {
        expect(wrapper.find('fieldset').prop('disabled')).toBe(true);
      },
    );

    wrapper.setProps(
      { appState: { ...store, activeGistAction: GistActionState.none } },
      () => {
        expect(wrapper.find('fieldset').prop('disabled')).toBe(false);
      },
    );
  });
});
