import { describe, expect, it, vi } from 'vitest';

const setAboutPanelOptions = vi.fn();
vi.mock('electron', () => ({
  app: {
    getName: () => 'Electron Fiddle',
    getVersion: () => '1.2.3',
    getAppPath: () => '/nowhere',
    setAboutPanelOptions: (...args: unknown[]) => setAboutPanelOptions(...args),
  },
}));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));

const { setupAboutPanel } = await import('./about');

describe('setupAboutPanel', () => {
  it('lists the bundled contributors', () => {
    setupAboutPanel();
    expect(setAboutPanelOptions).toHaveBeenCalledTimes(1);
    const options = setAboutPanelOptions.mock.calls[0]![0] as {
      authors: string[];
      credits: string;
      website: string;
    };
    expect(options.authors.length).toBeGreaterThan(0);
    expect(options.authors).toContain('felixrieseberg');
    expect(options.credits).toBe(options.authors.join(', '));
    expect(options.website).toBe('https://electronjs.org/fiddle');
  });
});
