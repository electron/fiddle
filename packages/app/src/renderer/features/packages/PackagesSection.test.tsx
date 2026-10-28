import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  modulesApi: {
    SearchPackages: vi.fn(() =>
      Promise.resolve([{ name: 'lodash', version: '4.17.21' }]),
    ),
    AddModule: vi.fn(() => Promise.resolve(2)),
    GetPackageVersions: vi.fn((_name: string) =>
      Promise.resolve({ latest: '', versions: [] as string[] }),
    ),
    SetModuleVersion: vi.fn((_name: string, _version: string) => Promise.resolve(2)),
    RemoveModule: vi.fn((_name: string) => Promise.resolve(2)),
  },
  modules: {} as Record<string, string>,
  showToast: vi.fn(),
}));

vi.mock('../../../ipc/renderer', () => ({ modulesApi: mocks.modulesApi }));
vi.mock('../../state', () => ({
  useWindowState: () => ({ fiddle: { modules: mocks.modules } }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key} ${options.name}` : key,
  }),
}));
vi.mock('../../../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../ui')>()),
  showToast: mocks.showToast,
}));

import { PackagesSection } from './PackagesSection';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modules = {};
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

describe('PackagesSection search', () => {
  it('says when the registry search failed', async () => {
    mocks.modulesApi.SearchPackages.mockRejectedValueOnce(new Error('offline'));
    render(<PackagesSection />);
    typeName('lod');
    expect(await screen.findByText('searchFailed')).toBeTruthy();
  });
});

describe('PackagesSection modules', () => {
  const versionMenu = () => screen.getByRole('button', { name: /version left-pad/ });

  it("lists the fiddle's modules, changes a version and removes a module", async () => {
    mocks.modules = { 'left-pad': '1.2.0' };
    mocks.modulesApi.GetPackageVersions.mockResolvedValue({
      latest: '1.3.0',
      versions: ['1.3.0', '1.2.0', '1.1.0'],
    });
    render(<PackagesSection />);
    expect(screen.getByRole('list', { name: 'list' }).textContent).toContain('left-pad');
    await act(async () => undefined);

    fireEvent.click(versionMenu());
    const names = (await screen.findAllByRole('option')).map((o) =>
      o.getAttribute('aria-label'),
    );
    expect(names).toEqual(['1.3.0 latest', '1.2.0', '1.1.0']);
    fireEvent.click(screen.getByRole('option', { name: '1.2.0' }));
    expect(mocks.modulesApi.SetModuleVersion).not.toHaveBeenCalled();

    fireEvent.click(versionMenu());
    fireEvent.click(await screen.findByRole('option', { name: '1.3.0 latest' }));
    expect(mocks.modulesApi.SetModuleVersion).toHaveBeenCalledWith('left-pad', '1.3.0');

    mocks.modulesApi.RemoveModule.mockRejectedValueOnce(new Error('read-only'));
    fireEvent.click(screen.getByRole('button', { name: 'remove left-pad' }));
    expect(mocks.modulesApi.RemoveModule).toHaveBeenCalledWith('left-pad');
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith({
        tone: 'error',
        title: 'changeFailed left-pad',
        description: 'read-only',
      }),
    );
  });

  it('lists just the current version when the registry cannot be reached', async () => {
    mocks.modules = { 'is-odd': '3.0.1' };
    mocks.modulesApi.GetPackageVersions.mockRejectedValue(new Error('offline'));
    render(<PackagesSection />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: /version is-odd/ }));
    const names = (await screen.findAllByRole('option')).map((o) =>
      o.getAttribute('aria-label'),
    );
    expect(names).toEqual(['3.0.1']);
  });
});
