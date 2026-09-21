/** The Lucent gallery renders its specimen sections, and its title bar drives the document theme. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Gallery } from './Gallery';

describe('Gallery', () => {
  // Every component in one tree: slow to render under jsdom, hence the longer timeout.
  it(
    'renders the sections and switches the material off from the title bar',
    { timeout: 20_000 },
    () => {
      render(<Gallery initialAppearance="light" />);
      const headings = [...document.querySelectorAll('section > h2')].map(
        (heading) => heading.textContent,
      );
      expect(headings.length).toBeGreaterThanOrEqual(6);
      expect(headings).toEqual(expect.arrayContaining(['Actions', 'Inputs', 'Type']));
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(document.documentElement.classList.contains('lu-no-material')).toBe(false);
      fireEvent.click(screen.getByRole('switch', { name: 'No material' }));
      expect(document.documentElement.classList.contains('lu-no-material')).toBe(true);
    },
  );
});
