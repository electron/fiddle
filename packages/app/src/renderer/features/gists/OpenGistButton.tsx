import { useTranslation } from 'react-i18next';

import { ToolbarButton } from '../../../ui';
import { useShortcut } from '../../use-shortcut';
import { showGistDialog } from './state';

export function OpenGistButton() {
  const { t } = useTranslation('gists');
  const kbd = useShortcut('gist.open');
  return (
    <ToolbarButton
      icon="link"
      label={t('openGist')}
      tooltip={{ kbd }}
      onPress={() => showGistDialog({ kind: 'open' })}
    />
  );
}
