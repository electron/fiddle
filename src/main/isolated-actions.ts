import { WebContents, WebFrameMain, net, protocol } from 'electron';

export const ISOLATED_ACTIONS_SCHEME = 'isolated-actions';
export const ISOLATED_ACTIONS_RUN_BUTTON_HOST = 'run-button';
export const ISOLATED_ACTIONS_RUN_BUTTON_URL = `${ISOLATED_ACTIONS_SCHEME}://${ISOLATED_ACTIONS_RUN_BUTTON_HOST}/`;

const RUN_BUTTON_ENTRY_NAME = 'isolated_run_button';

declare const ISOLATED_RUN_BUTTON_WEBPACK_ENTRY: string;

/**
 * Register `isolated-actions://` as a scheme. This call
 * MUST happen before `app.whenReady()` resolves.
 */
export function registerIsolatedActionsScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ISOLATED_ACTIONS_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: false,
        codeCache: true,
      },
    },
  ]);
}

export function setupIsolatedActionsProtocol() {
  // The webpack entry points at the entry's own index.html. Walk up
  // one level so we have a base that the entry-name-prefixed asset
  // paths slot into directly.
  const entryDirSuffix = `/${RUN_BUTTON_ENTRY_NAME}/`;
  const entryDirIndex =
    ISOLATED_RUN_BUTTON_WEBPACK_ENTRY.lastIndexOf(entryDirSuffix);
  if (entryDirIndex < 0) {
    throw new Error(
      `Unexpected webpack entry shape: ${ISOLATED_RUN_BUTTON_WEBPACK_ENTRY}`,
    );
  }
  const upstreamRoot = ISOLATED_RUN_BUTTON_WEBPACK_ENTRY.slice(
    0,
    entryDirIndex,
  );

  protocol.handle(ISOLATED_ACTIONS_SCHEME, async (request) => {
    const url = new URL(request.url);

    if (url.host !== ISOLATED_ACTIONS_RUN_BUTTON_HOST) {
      return new Response(null, { status: 404 });
    }

    let pathname = url.pathname;

    // Refuse path traversal — anything with `..` could escape the
    // upstream output directory once we resolve it.
    if (pathname.includes('..')) {
      return new Response(null, { status: 400 });
    }

    // The iframe loads `isolated-actions://run-button/`. The HTML it
    // pulls back references its bundle as `/isolated_run_button/...`;
    // those resolve back through this handler and need the upstream
    // entry's index.html for the bare root.
    if (pathname === '/' || pathname === '') {
      pathname = `${entryDirSuffix}index.html`;
    }

    // Anything else is a webpack-emitted absolute path
    // (`/isolated_run_button/<asset>`) that already lines up with the
    // upstream layout — pass it through unchanged.
    return net.fetch(`${upstreamRoot}${pathname}`, {
      bypassCustomProtocolHandlers: true,
    });
  });
}

/**
 * Find the isolated run button frame inside `webContents`.
 */
export function getIsolatedRunButtonFrame(
  webContents: WebContents,
): WebFrameMain | null {
  const frames = webContents.mainFrame?.framesInSubtree;
  if (!frames) return null;
  return (
    frames.find((frame) => {
      try {
        return new URL(frame.url).protocol === `${ISOLATED_ACTIONS_SCHEME}:`;
      } catch {
        return false;
      }
    }) ?? null
  );
}
