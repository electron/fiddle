import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { githubApi } from '../../../ipc/renderer';
import {
  Menu,
  MenuItem,
  MenuPopover,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  showToast,
  ToolbarButton,
} from '../../../ui';
import { useCommand, useShortcut } from '../../hooks';
import { copyShareLink, deleteGist, setGistVisibility, updateGist } from './actions';
import { GistDialogs } from './GistDialogs';
import {
  requestPublish,
  showGistDialog,
  useGistSettings,
  useGitHubLogin,
  useLoadedGist,
  withSignIn,
} from './state';

const DIALOGS = {
  'gist.open': 'open',
  'gist.history': 'history',
  'gist.signIn': 'sign-in',
} as const;

/** Publishes, or with a gist loaded opens the gist menu. It also hosts the gist dialogs and answers the `gist.*` commands. */
export function PublishButton({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useTranslation('gists');
  const login = useGitHubLogin();
  const gist = useLoadedGist();
  const { isPublic, showHistory } = useGistSettings();
  // Only the owner can update or delete a gist. Signed out, the sign-in decides.
  const foreign =
    !!gist?.owner && !!login && gist.owner.toLowerCase() !== login.toLowerCase();
  const openKbd = useShortcut('gist.open');

  useCommand((id) => {
    if (id === 'gist.publish') requestPublish(login);
    else if (Object.hasOwn(DIALOGS, id))
      showGistDialog({ kind: DIALOGS[id as keyof typeof DIALOGS] });
  });

  useEffect(() => {
    githubApi.TakeNotice().then(
      (notice) => {
        if (notice === 'decrypt-failed') {
          showToast({
            tone: 'warning',
            title: t('noticeDecryptFailed'),
            description: t('noticeDecryptFailedDetail'),
          });
        }
      },
      () => undefined,
    );
  }, [t]);

  const button = (
    <ToolbarButton
      data-tour="publish"
      icon="upload"
      label={t('publishButton')}
      tooltip
      onPress={gist ? undefined : () => requestPublish(login)}
    >
      {compact ? undefined : t('publishButton')}
    </ToolbarButton>
  );

  return (
    <>
      {gist ? (
        <MenuTrigger>
          {button}
          <MenuPopover placement="bottom end" offset={10}>
            <Menu aria-label={t('menuLabel')}>
              <MenuItem
                id="update"
                icon="upload"
                isDisabled={foreign}
                onAction={() => withSignIn(login, () => void updateGist(t))}
              >
                {t('menuUpdate')}
              </MenuItem>
              <MenuItem id="publish" icon="plus" onAction={() => requestPublish(login)}>
                {t('menuPublishNew')}
              </MenuItem>
              <MenuItem id="copy" icon="link" onAction={() => copyShareLink(t, gist.id)}>
                {t('menuCopyLink')}
              </MenuItem>
              {showHistory && (
                <MenuItem
                  id="history"
                  icon="history"
                  onAction={() => showGistDialog({ kind: 'history' })}
                >
                  {t('menuHistory')}
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem
                id="open"
                icon="link"
                kbd={openKbd}
                onAction={() => showGistDialog({ kind: 'open' })}
              >
                {t('openGist')}
              </MenuItem>
              <MenuSeparator />
              <MenuSection
                title={t('menuVisibility')}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[isPublic ? 'public' : 'secret']}
                onSelectionChange={(keys) =>
                  setGistVisibility(new Set(keys).has('public'))
                }
              >
                <MenuItem id="secret" icon="lock">
                  {t('visibilitySecret')}
                </MenuItem>
                <MenuItem id="public" icon="unlock">
                  {t('visibilityPublic')}
                </MenuItem>
              </MenuSection>
              <MenuSeparator />
              <MenuItem
                id="delete"
                icon="trash"
                isDanger
                isDisabled={foreign}
                onAction={() => withSignIn(login, () => void deleteGist(t))}
              >
                {t('menuDelete')}
              </MenuItem>
            </Menu>
          </MenuPopover>
        </MenuTrigger>
      ) : (
        button
      )}
      <GistDialogs />
    </>
  );
}
