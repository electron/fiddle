// Strings that only test-build code contains. A release build must have none of them;
// packages/app/tools/driver-release-check.ts also checks that a test build has them all.
export const MARKERS = [
  // src/main/test-driver
  'ELECTRON_FIDDLE_DRIVER_SOCKET',
  'Accessibility.getFullAXTree',
  'non-loopback request',
  '__fiddleTest',
  // src/main/test-mode.ts, behind TEST_BUILD
  'FIDDLE_TEST_MODE',
  'FIDDLE_TEST_DIR',
  'FIDDLE_TEST_FIXTURE_URL',
  'FIDDLE_TEST_MENUBAR',
];
