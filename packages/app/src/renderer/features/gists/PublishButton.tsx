import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { githubApi, windowApi } from '../../../ipc/renderer';
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

/**
 * The title bar's Publish capsule. With no gist loaded it publishes; once a
 * gist is loaded it opens the gist menu. It also hosts the gist dialogs and
 * answers the gist commands (`Window.Command`).
 */
const DIALOGS = { 'gist.open': 'open', 'gist.history': 'history', 'gist.signIn': 'sign-in' } as const;

export function PublishButton() {
  const { t } = useTranslation('gists');
  const login = useGitHubLogin();
  const gist = useLoadedGist();
  const { isPublic } = useGistSettings();

  const loginRef = useRef(login);
  useEffect(() => {
    loginRef.current = login;
  }, [login]);

  useEffect(
    () =>
      windowApi.onCommand((id) => {
        if (id === 'gist.publish') requestPublish(loginRef.current);
        else if (Object.hasOwn(DIALOGS, id)) showGistDialog({ kind: DIALOGS[id as keyof typeof DIALOGS] });
      }),
    [],
  );

  useEffect(() => {
    githubApi.TakeNotice().then(
      (notice) => {
        if (notice === 'decrypt-failed') {
          showToast({ tone: 'warning', title: t('noticeDecryptFailed'), description: t('noticeDecryptFailedDetail') });
        }
      },
      () => undefined,
    );
  }, [t]);

  const onAction = (key: string) => {
    if (!gist) return;
    switch (key) {
      case 'update':
        withSignIn(login, () => void updateGist(t));
        break;
      case 'publish':
        requestPublish(login);
        break;
      case 'copy':
        copyShareLink(t, gist.id);
        break;
      case 'history':
        showGistDialog({ kind: 'history' });
        break;
      case 'secret':
      case 'public':
        setGistVisibility(key === 'public');
        break;
      case 'delete':
        withSignIn(login, () => void deleteGist(t));
        break;
    }
  };

  return (
    <>
      {gist ? (
        <MenuTrigger>
          <ToolbarButton data-tour="publish" icon="upload">{t('publishButton')}</ToolbarButton>
          <MenuPopover placement="bottom end" offset={10}>
            <Menu aria-label={t('menuLabel')} onAction={(key) => onAction(String(key))}>
              <MenuItem id="update" icon="upload">
                {t('menuUpdate')}
              </MenuItem>
              <MenuItem id="publish" icon="plus">
                {t('menuPublishNew')}
              </MenuItem>
              <MenuItem id="copy" icon="link">
                {t('menuCopyLink')}
              </MenuItem>
              <MenuItem id="history" icon="history">
                {t('menuHistory')}
              </MenuItem>
              <MenuSeparator />
              <MenuSection
                title={t('menuVisibility')}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[isPublic ? 'public' : 'secret']}
              >
                <MenuItem id="secret" icon="lock">
                  {t('visibilitySecret')}
                </MenuItem>
                <MenuItem id="public" icon="unlock">
                  {t('visibilityPublic')}
                </MenuItem>
              </MenuSection>
              <MenuSeparator />
              <MenuItem id="delete" icon="trash" isDanger>
                {t('menuDelete')}
              </MenuItem>
            </Menu>
          </MenuPopover>
        </MenuTrigger>
      ) : (
        <ToolbarButton data-tour="publish" icon="upload" onPress={() => requestPublish(login)}>
          {t('publishButton')}
        </ToolbarButton>
      )}
      <GistDialogs />
    </>
  );
}
