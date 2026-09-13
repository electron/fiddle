import '../ui/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import { initRendererI18n } from '../i18n/renderer';
import { appApi, windowApi } from '../ipc/renderer';
import { App } from './App';

async function start(): Promise<void> {
  // Read both stores before first paint. Main shows the window once we report ready.
  const [app] = await Promise.all([
    appApi.AppStore.getState(),
    windowApi.WindowStore.getState(),
  ]);

  const root = document.documentElement;
  root.lang = app.locale;
  root.dataset.platform = app.platform;
  // Lucent: without an OS material, the tokens swap to their opaque fallbacks.
  root.classList.toggle('lu-no-material', app.material === 'none');

  const i18n = await initRendererI18n(app.locale);
  const container = document.getElementById('root');
  if (!container) throw new Error('#root is missing from index.html');

  createRoot(container).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </StrictMode>,
  );

  requestAnimationFrame(() => {
    void windowApi.ReportReady();
  });
}

void start();
