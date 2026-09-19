// Develop > Open component gallery: the Lucent gallery in a window of its own, in test builds only.
import { describe, expect, it } from 'vitest';

import { role, useApp } from './harness.ts';

describe('component gallery', () => {
  const app = useApp();

  it('opens in a second window that holds no fiddle', async () => {
    await app().runCommand('dev.openGallery');
    const gallery = await app().waitForWindow(1);
    expect(gallery).toMatchObject({
      visible: true,
      title: 'Lucent gallery',
      url: 'app://main/src/ui/gallery/index.html',
    });
    expect(gallery.windowId).toBeUndefined();
    expect((await app().stores(1)).window).toBeNull();
  });

  it('renders the gallery, with its landmarks in the accessibility snapshot', async () => {
    await app().query(role('heading', 'Actions', { window: 1 }));
    const snapshot = await app().snapshot(1);
    expect(snapshot).toMatch(/^RootWebArea "Lucent gallery"/);
    expect(snapshot).toMatch(/\n +main\n/);
    expect(snapshot).toContain('heading "Navigation and structure"');
  });

  it('is reused when the command runs again, and leaves the isolation checks clean', async () => {
    await app().runCommand('dev.openGallery');
    expect(await app().windows()).toHaveLength(2);
    expect(await app().violations()).toEqual([]);
  });
});
