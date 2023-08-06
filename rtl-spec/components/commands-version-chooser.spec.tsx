import * as React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VersionChooser } from '../../src/renderer/components/commands-version-chooser';
import { AppState } from '../../src/renderer/state';
import { mockVersion1, prepareAppState } from '../test-utils/versions';

describe('VersionSelect component', () => {
  let appState: AppState;

  beforeEach(() => {
    appState = prepareAppState();

    // the version selector is disabled when bisecting
    appState.Bisector = undefined;
  });

  it('selects a new version', async () => {
    const { getByRole } = render(<VersionChooser appState={appState} />);

    const btnOpenVersionSelector = getByRole('button');

    await userEvent.click(btnOpenVersionSelector);

    const versionButton = screen.getByText(mockVersion1.version);

    await userEvent.click(versionButton);

    expect(appState.setVersion).toHaveBeenCalledWith(mockVersion1.version);
  });
});
