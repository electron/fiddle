import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { githubApi } from '../../../ipc/renderer';
import { FiddleError } from '../../../shared/errors';
import { Button, FormField, Icon, showToast } from '../../../ui';
import styles from './gists.module.css';
import { SignInDialog } from './SignInDialog';
import { useGitHubLogin } from './state';

/** Settings: the GitHub account, to sign in or out. */
export function GitHubAccountSection() {
  const { t } = useTranslation('gists');
  const login = useGitHubLogin();
  const [signingIn, setSigningIn] = useState(false);

  const signOut = () => {
    githubApi
      .SignOut()
      .catch((error: unknown) =>
        showToast({ tone: 'error', title: FiddleError.from(error).message }),
      );
  };

  return (
    <div className={styles.section}>
      <FormField label={t('accountLabel')} inline>
        <div className={styles.account}>
          <Icon name="user" className={styles.accountIcon} />
          <span className={styles.accountName}>
            {login ? t('accountSignedInAs', { login }) : t('accountSignedOut')}
          </span>
          {login ? (
            <Button size="sm" onPress={signOut}>
              {t('accountSignOut')}
            </Button>
          ) : (
            <Button size="sm" variant="primary" onPress={() => setSigningIn(true)}>
              {t('accountSignIn')}
            </Button>
          )}
        </div>
      </FormField>
      {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
    </div>
  );
}
