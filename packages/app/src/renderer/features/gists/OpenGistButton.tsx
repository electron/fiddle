import { useTranslation } from 'react-i18next';

import { ToolbarButton, Tooltip } from '../../../ui';
import { useShortcut } from '../../use-shortcut';
import { showGistDialog } from './state';

export function OpenGistButton() {
  const { t } = useTranslation('gists');
  const kbd = useShortcut('gist.open');
  return (
    <Tooltip label={t('openGist')} kbd={kbd}>
      <ToolbarButton
        icon="link"
        label={t('openGist')}
        onPress={() => showGistDialog({ kind: 'open' })}
      />
    </Tooltip>
  );
}
