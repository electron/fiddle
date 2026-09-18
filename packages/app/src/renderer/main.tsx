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
  // Read both stores before first paint. App reports ready once it has painted
  // with both stores, and main shows the window then.
  const [app] = await Promise.all([
    appApi.AppStore.getState(),
    windowApi.WindowStore.getState(),
  ]);

  const root = document.documentElement;
  root.lang = app.locale;
  root.dataset.platform = app.platform;
  // Lucent: without an OS material, the tokens swap to their opaque fallbacks.
  root.classList.toggle('lu-no-material', app.material === 'none');
  root.dataset.material = app.material;

  // Monaco reads its strings while its modules load, and App imports it: the locale's bundle goes first.
  const [i18n, { App }] = await Promise.all([
    initRendererI18n(app.locale),
    loadMonacoMessages(app.locale).then(() => import('./App')),
  ]);
  void installPlatformRenderer(i18n);
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
