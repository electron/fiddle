import * as React from 'react';

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderClassComponentWithInstanceRef } from '../../../rtl-spec/test-utils/renderClassComponentWithInstanceRef';
import { SidebarPackageManager } from '../../../src/renderer/components/sidebar-package-manager';
import { AppState } from '../../../src/renderer/state';

vi.mock('../../../src/renderer/npm-search', () => ({
  npmSearch: {
    // this is just enough mocking to hit the right code paths
    // by stubbing out the npmSearch utility.
    search: () => ({
      hits: [
        {
          versions: ['1.0.0'],
        },
      ],
    }),
  },
}));

describe('SidebarPackageManager component', () => {
  let store: AppState;
  beforeEach(() => {
    store = {
      modules: new Map<string, string>([['cow', '1.0.0']]),
    } as AppState;
  });

  it('renders', () => {
    render(<SidebarPackageManager appState={store} />);
    expect(screen.getByText('Modules')).toBeInTheDocument();
    expect(screen.getByText('cow')).toBeInTheDocument();
  });

  it('can add a package', () => {
    const { instance } = renderClassComponentWithInstanceRef(
      SidebarPackageManager,
      { appState: store },
    );
    // Bypass Readonly<S> to set state without triggering a re-render
    (instance as any).state = {
      suggestions: [],
      versionsCache: new Map(),
    };

    instance.addModuleToFiddle({
      objectID: 'say',
      name: 'say',
      version: '2.0.0',
      versions: {
        '1.0.0': '',
        '2.0.0': '',
      },
    } as any);

    expect(
      Array.from((store.modules as Map<string, string>).entries()),
    ).toEqual([
      ['cow', '1.0.0'],
      ['say', '2.0.0'],
    ]);
  });

  it('can remove a package', async () => {
    const user = userEvent.setup();
    render(<SidebarPackageManager appState={store} />);

    // Find the remove button (the Button with icon="remove" next to "cow")
    const removeButton = screen.getByRole('button');
    await user.click(removeButton);
    expect((store.modules as Map<string, string>).size).toBe(0);
  });
});
