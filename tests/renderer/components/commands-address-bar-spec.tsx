import * as React from 'react';
import { observable } from 'mobx';
import { shallow } from 'enzyme';

import { AddressBar } from '../../../src/renderer/components/commands-address-bar';
import { GistActionState } from '../../../src/interfaces';
import { urlFromId } from '../../../src/utils/gist';

import { ElectronFiddleMock } from '../../mocks/electron-fiddle';

jest.mock('../../../src/utils/octokit');

describe('AddressBar component', () => {
  let store: any;
  let editorMosaic: any;

  class MockStore {
    @observable public gistId: string | null = null;
    @observable public isWarningDialogShowing = false;
    @observable public isConfirmationPromptShowing = false;
    public setGenericDialogOptions = jest.fn();
    public toggleWarningDialog = jest.fn();
  }

  beforeEach(() => {
    const electronFiddle = new ElectronFiddleMock();
    (window as any).ElectronFiddle = new ElectronFiddleMock();
    store = new MockStore();
    editorMosaic = electronFiddle.app.editorMosaic;
  });

  function createAddressBar() {
    const wrapper = shallow(
      <AddressBar appState={store} editorMosaic={editorMosaic} />,
    );
    const instance: AddressBar = wrapper.instance() as any;
    return { instance, wrapper };
  }

  it('renders', () => {
    const { wrapper } = createAddressBar();
    expect(wrapper).toMatchSnapshot();
  });

  it('uses a AppState.gistId', () => {
    const gistId1 = '5b827f4aafa7ee29bdc70282ecc31640';
    const gistId2 = '2f748f0c0079769e9532924b117f9252';

    // uses the gistId that was present when the wrapper was created...
    store.gistId = gistId1;
    const { wrapper } = createAddressBar();
    expect((wrapper.state() as any).value).toBe(urlFromId(store.gistId));

    // ..and updates it based on changes to the AppState.gistId
    store.gistId = gistId2;
    expect((wrapper.state() as any).value).toBe(urlFromId(store.gistId));
  });

  it('handles change', () => {
    const value = 'hi';
    const { instance, wrapper } = createAddressBar();
    instance.handleChange({ target: { value } } as any);

    expect(wrapper.state('value')).toBe(value);
  });

  it('handles submit', () => {
    const preventDefault = jest.fn();
    const { instance, wrapper } = createAddressBar();

    instance.handleChange({ target: { value: 'abcdtestid' } } as any);
    wrapper.find('form').simulate('submit', { preventDefault });

    expect(wrapper.state('value')).toBe('abcdtestid');
    expect(preventDefault).toHaveBeenCalled();
  });

  it('disables during gist publishing', async () => {
    const { wrapper } = createAddressBar();

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
    const { wrapper } = createAddressBar();

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
    const { wrapper } = createAddressBar();

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
