import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  modulesApi: {
    SearchPackages: vi.fn(() =>
      Promise.resolve([{ name: 'lodash', version: '4.17.21' }]),
    ),
    AddModule: vi.fn(() => Promise.resolve(2)),
    GetPackageVersions: vi.fn(() => Promise.resolve({ latest: '', versions: [] })),
  },
}));

vi.mock('../../../ipc/renderer', () => ({ modulesApi: mocks.modulesApi }));
vi.mock('../../state', () => ({
  useWindowState: () => ({ fiddle: { modules: {} } }),
}));

import { PackagesSection } from './PackagesSection';

beforeEach(() => {
  vi.clearAllMocks();
});

function typeName(value: string): HTMLElement {
  const input = screen.getByRole('combobox', { name: 'addLabel' });
  act(() => input.focus());
  fireEvent.change(input, { target: { value } });
  return input;
}

describe('PackagesSection add', () => {
  it('adds the version the suggestion shows', async () => {
    render(<PackagesSection />);
    typeName('lod');
    fireEvent.click(await screen.findByRole('option', { name: /lodash/ }));
    await waitFor(() =>
      expect(mocks.modulesApi.AddModule).toHaveBeenCalledWith('lodash', '4.17.21'),
    );
  });

  it('adds a typed name on Enter when no suggestion is highlighted', async () => {
    render(<PackagesSection />);
    const input = typeName('lodash');
    await screen.findByRole('option', { name: /lodash/ });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(mocks.modulesApi.AddModule).toHaveBeenCalledWith('lodash', '4.17.21'),
    );
    expect(mocks.modulesApi.AddModule).toHaveBeenCalledTimes(1);
  });
});
