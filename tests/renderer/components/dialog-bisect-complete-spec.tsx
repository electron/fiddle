import { shallow } from 'enzyme';
import * as React from 'react';
import { BisectCompleteDialog } from '../../../src/renderer/components/dialog-bisect-complete';

describe('BisectCompleteDialog component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      lastBisectResult: ['0.0.0', '0.0.1'],
      isBisectCompleteDialogShowing: true
    };
  });

  it('renders', () => {
    const wrapper = shallow(<BisectCompleteDialog appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });
});
