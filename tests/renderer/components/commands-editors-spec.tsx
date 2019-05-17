import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { EditorId } from '../../../src/interfaces';
import { EditorDropdown } from '../../../src/renderer/components/commands-editors';
import { getVisibleMosaics } from '../../../src/utils/editors-mosaic-arrangement';

jest.mock('../../../src/utils/editors-mosaic-arrangement');

describe('EditorDropdown component', () => {
  let store: any;

  beforeEach(() => {
    (process.env as any).FIDDLE_DOCS_DEMOS = false;

    store = {
      hideAndBackupMosaic: jest.fn(),
      showMosaic: jest.fn(),
      closedPanels: {}
    };

    (getVisibleMosaics as jest.Mock).mockReturnValue([ EditorId.html, EditorId.renderer ]);
  });

  it('renders', () => {
    const wrapper = shallow(<EditorDropdown appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the extra button if the FIDDLE_DOCS_DEMOS is set', () => {
    (process.env as any).FIDDLE_DOCS_DEMOS = true;

    const wrapper = shallow(<EditorDropdown appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click for an item', () => {
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    dropdown.onItemClick({ currentTarget: { id: EditorId.html } } as any);
    expect(store.hideAndBackupMosaic).toHaveBeenCalledTimes(1);
    expect(store.showMosaic).toHaveBeenCalledTimes(0);

    dropdown.onItemClick({ currentTarget: { id: EditorId.main } } as any);
    expect(store.hideAndBackupMosaic).toHaveBeenCalledTimes(1);
    expect(store.showMosaic).toHaveBeenCalledTimes(1);
  });
});
