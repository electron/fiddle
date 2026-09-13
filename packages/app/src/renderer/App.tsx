import { useTranslation } from 'react-i18next';

import { useAppStore, useWindowStore } from '../ipc/renderer';

/** Placeholder until the app shell lands (milestone 2). */
export function App() {
  const { t } = useTranslation();
  const app = useAppStore();
  const win = useWindowStore();

  return (
    <main>
      <h1>{t('appName')}</h1>
      {app.state === 'ready' && win.state === 'ready' && (
        <p data-testid="scaffold-status">
          {t('scaffoldStatus', {
            platform: app.result.platform,
            appRev: app.result.rev,
            windowRev: win.result.rev,
          })}
        </p>
      )}
    </main>
  );
}
