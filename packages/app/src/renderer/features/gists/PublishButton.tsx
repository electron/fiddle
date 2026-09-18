import { useEffect, useEffectEvent } from 'react';
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
  Tooltip,
} from '../../../ui';
import { useShortcut } from '../../use-shortcut';
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

/**
 * The title bar's Publish capsule. With no gist loaded it publishes; once a
 * gist is loaded it opens the gist menu. It also hosts the gist dialogs and
 * answers the gist commands (`Window.Command`). `compact`: a narrow title bar
 * shows Publish as an icon button; its tooltip keeps the label.
 */
export function PublishButton({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useTranslation('gists');
  const login = useGitHubLogin();
  const gist = useLoadedGist();
  const { isPublic, showHistory } = useGistSettings();
  const openKbd = useShortcut('gist.open');

  const onCommand = useEffectEvent((id: string) => {
    if (id === 'gist.publish') requestPublish(login);
    else if (Object.hasOwn(DIALOGS, id))
      showGistDialog({ kind: DIALOGS[id as keyof typeof DIALOGS] });
  });
  useEffect(() => windowApi.onCommand((id) => onCommand(id)), []);

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
      case 'open':
        showGistDialog({ kind: 'open' });
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

  const button = (
    <Tooltip label={t('publishButton')} isDisabled={!compact}>
      <ToolbarButton
        data-tour="publish"
        icon="upload"
        label={t('publishButton')}
        onPress={gist ? undefined : () => requestPublish(login)}
      >
        {compact ? undefined : t('publishButton')}
      </ToolbarButton>
    </Tooltip>
  );

  return (
    <>
      {gist ? (
        <MenuTrigger>
          {button}
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
              {showHistory && (
                <MenuItem id="history" icon="history">
                  {t('menuHistory')}
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem id="open" icon="link" kbd={openKbd}>
                {t('openGist')}
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
        button
      )}
      <GistDialogs />
    </>
  );
}
