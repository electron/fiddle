// Setup for the `app:jsdom` Vitest project. Vitest runs without globals, so
// Testing Library can't register its own cleanup: unmount after every test.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
