import * as React from 'react';

import { shallow } from 'enzyme';
import { beforeEach, describe, expect, it } from 'vitest';

import { Dialogs } from '../../../src/renderer/components/dialogs';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform } from '../../utils';

describe('Dialogs component', () => {
  let store: AppState;

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
    store.isGenericDialogShowing = true;
  });

  it('renders the token dialog', () => {
    store.isTokenDialogShowing = true;
    const wrapper = shallow(<Dialogs appState={store} />);
    expect(wrapper.text()).toBe('<TokenDialog2 /><GenericDialog2 />');
  });

  it('renders the settings dialog', () => {
    store.isSettingsShowing = true;
    const wrapper = shallow(<Dialogs appState={store} />);
    expect(wrapper.text()).toBe('<Settings2 /><GenericDialog2 />');
  });

  it('renders the add version dialog', () => {
    store.isAddVersionDialogShowing = true;
    const wrapper = shallow(<Dialogs appState={store} />);
    expect(wrapper.text()).toBe('<AddVersionDialog2 /><GenericDialog2 />');
  });
});
