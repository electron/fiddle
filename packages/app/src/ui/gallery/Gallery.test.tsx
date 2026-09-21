/** The Lucent gallery renders every specimen section, and its title bar drives the document theme. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Gallery } from './Gallery';

describe('Gallery', () => {
  // Every component in one tree: slow to render under jsdom, hence the longer timeout.
  it(
    'renders every section and switches the material off from the title bar',
    { timeout: 20_000 },
    () => {
      render(<Gallery initialAppearance="light" />);
      expect(
        [...document.querySelectorAll('section > h2')].map(
          (heading) => heading.textContent,
        ),
      ).toEqual([
        'Actions',
        'Inputs',
        'Navigation and structure',
        'Labels',
        'Feedback and overlays',
        'Content',
        'Icons',
        'Type',
      ]);
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(document.documentElement.classList.contains('lu-no-material')).toBe(false);
      fireEvent.click(screen.getByRole('switch', { name: 'No material' }));
      expect(document.documentElement.classList.contains('lu-no-material')).toBe(true);
    },
  );
});
