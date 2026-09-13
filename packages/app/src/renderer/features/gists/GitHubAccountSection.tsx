import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { githubApi, settingsApi } from '../../../ipc/renderer';
import { Button, FormField, Icon, Switch } from '../../../ui';
import styles from './gists.module.css';
import { SignInDialog } from './SignInDialog';
import { useGistSettings, useGitHubLogin } from './state';

/** Settings: the GitHub account (sign in or out) and "Publish as revision". */
export function GitHubAccountSection() {
  const { t } = useTranslation('gists');
  const login = useGitHubLogin();
  const { asRevision } = useGistSettings();
  const [signingIn, setSigningIn] = useState(false);

  return (
    <div className={styles.section}>
      <FormField label={t('accountLabel')} inline>
        <div className={styles.account}>
          <Icon name="user" className={styles.accountIcon} />
          <span className={styles.accountName}>
            {login ? t('accountSignedInAs', { login }) : t('accountSignedOut')}
          </span>
          {login ? (
            <Button size="sm" onPress={() => void githubApi.SignOut()}>
              {t('accountSignOut')}
            </Button>
          ) : (
            <Button size="sm" variant="primary" onPress={() => setSigningIn(true)}>
              {t('accountSignIn')}
            </Button>
          )}
        </div>
      </FormField>
      <FormField label={t('asRevisionLabel')} helper={t('asRevisionHelp')} inline>
        <Switch
          aria-label={t('asRevisionLabel')}
          isSelected={asRevision}
          onChange={(value) => void settingsApi.SetSetting('gistPublishAsRevision', value)}
        />
      </FormField>
      {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
    </div>
  );
}
