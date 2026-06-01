import * as React from 'react';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Runner } from '../../../src/renderer/components/commands-runner';

describe('Runner component', () => {
  it('renders the run button as a cross-origin iframe', () => {
    const { container } = render(<Runner />);
    const iframe = container.querySelector(
      'iframe#button-run',
    ) as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute('src')).toMatch(
      /^isolated-actions:\/\/run-button\/\?initialTheme=/,
    );
    expect(iframe!.getAttribute('title')).toBe('Run Fiddle');
  });
});
