import { net } from 'electron';

/** `fetch` on Chromium's network stack, so the system proxy and certificates apply. */
export const netFetch: typeof fetch = (input, init) =>
  net.fetch(input instanceof URL ? input.href : input, init as RequestInit);
