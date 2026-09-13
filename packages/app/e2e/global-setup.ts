// Builds the test build once per `yarn test:e2e` run.
// FIDDLE_E2E_SKIP_BUILD=1 reuses out/test-build as it is.
import { buildTestApp } from '../tools/driver-build.ts';

export default async function setup(): Promise<void> {
  if (process.env.FIDDLE_E2E_SKIP_BUILD === '1') return;
  await buildTestApp();
}
