// First: before any module can parse a zod schema.
import './zod-jitless';
import '../ui/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import { loadMonacoMessages } from '../i18n/monaco-nls';
import { initRendererI18n } from '../i18n/renderer';
import { appApi, windowApi } from '../ipc/renderer';
import { installPlatformRenderer, log } from './features/about';
import { StoreProvider } from './state';

async function start(): Promise<void> {
  // The locale, platform and material are needed before the first render. If the App store can't be read, render
  // anyway: App shows the error, which a blank window can't.
  const app = await appApi.AppStore.getState().catch(() => undefined);

  const root = document.documentElement;
  if (app) {
    root.lang = app.locale;
    root.dataset.platform = app.platform;
    // Lucent: without an OS material, the tokens swap to their opaque fallbacks.
    root.classList.toggle('lu-no-material', app.material === 'none');
    root.dataset.material = app.material;
  }
  const locale = app?.locale ?? navigator.language;

  // Monaco reads its strings while its modules load, and App imports it: the locale's bundle goes first.
  const [i18n, { App }] = await Promise.all([
    initRendererI18n(locale),
    loadMonacoMessages(locale).then(() => import('./App')),
  ]);
  void installPlatformRenderer(i18n, app);
  const container = document.getElementById('root');
  if (!container) throw new Error('#root is missing from index.html');

  createRoot(container).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <StoreProvider>
          <App />
        </StoreProvider>
      </I18nextProvider>
    </StrictMode>,
  );
}

// Main shows the window only once it hears from the renderer, so a failed start still reports: a bare window beats a hidden one.
start().catch((error: unknown) => {
  log.error('the window failed to start', error);
  windowApi.ReportReady().catch(() => undefined);
});
