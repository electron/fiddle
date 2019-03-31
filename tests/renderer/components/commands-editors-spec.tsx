import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { EditorId } from '../../../src/interfaces';
import { EditorDropdown } from '../../../src/renderer/components/commands-editors';
import { getVisibleEditors } from '../../../src/utils/editors-mosaic-arrangement';

jest.mock('../../../src/utils/editors-mosaic-arrangement');

describe('EditorDropdown component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      hideAndBackupEditor: jest.fn(),
      showEditor: jest.fn()
    };

    (getVisibleEditors as jest.Mock).mockReturnValue([ EditorId.html, EditorId.renderer ]);
  });

  it('renders', () => {
    const wrapper = shallow(<EditorDropdown appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click for a visible item', () => {
    const wrapper = mount(<EditorDropdown appState={store} />);
    const dropdown = wrapper.instance() as EditorDropdown;

    dropdown.onItemClick(EditorId.html);
    expect(store.hideAndBackupEditor).toHaveBeenCalledTimes(1);
    expect(store.showEditor).toHaveBeenCalledTimes(0);

    dropdown.onItemClick(EditorId.main);
    expect(store.hideAndBackupEditor).toHaveBeenCalledTimes(1);
    expect(store.showEditor).toHaveBeenCalledTimes(1);
  });
});
