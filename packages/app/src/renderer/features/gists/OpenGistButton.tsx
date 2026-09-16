import { useTranslation } from 'react-i18next';

import { ToolbarButton, Tooltip } from '../../../ui';
import { showGistDialog, useOpenGistKbd } from './state';

/** The title bar's Open gist button, left of Publish. It opens the same dialog as `gist.open`. */
export function OpenGistButton() {
  const { t } = useTranslation('gists');
  const kbd = useOpenGistKbd();
  return (
    <Tooltip label={t('openGist')} kbd={kbd}>
      <ToolbarButton icon="link" label={t('openGist')} onPress={() => showGistDialog({ kind: 'open' })} />
    </Tooltip>
  );
}
