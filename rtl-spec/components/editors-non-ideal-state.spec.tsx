import React from 'react';

import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { RenderNonIdealState } from '../../src/renderer/components/editors-non-ideal-state';
import { EditorMosaic } from '../../src/renderer/editor-mosaic';

describe('RenderNonIdealState component', () => {
  let editorMosaic: EditorMosaic;

  beforeEach(() => {
    ({ editorMosaic } = window.app.state);
  });

  it('renders a non-ideal state', () => {
    const { getByText } = render(
      <RenderNonIdealState editorMosaic={{} as EditorMosaic} />,
    );

    expect(getByText('Reset editors')).toBeInTheDocument();
  });

  it('handles a click', async () => {
    const resetLayoutSpy = jest.spyOn(editorMosaic, 'resetLayout');
    const { getByRole } = render(
      <RenderNonIdealState editorMosaic={editorMosaic} />,
    );
    await userEvent.click(getByRole('button'));

    expect(resetLayoutSpy).toHaveBeenCalledTimes(1);
  });
});
