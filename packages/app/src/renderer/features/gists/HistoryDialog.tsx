import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useFormat } from '../../../i18n/renderer';
import { documentsApi, githubApi } from '../../../ipc/renderer';
import { FiddleError } from '../../../shared/errors';
import { Button, Dialog, List, ListRow, showToast, Spinner, Tag } from '../../../ui';
import styles from './gists.module.css';

type History = Awaited<ReturnType<typeof githubApi.GetHistory>>;
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; history: History };

/** The gist's revisions, newest first. Choosing one loads it. Mount it only while it's open. */
export function HistoryDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('gists');
  const { formatDate } = useFormat();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [loadingSha, setLoadingSha] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    githubApi.GetHistory().then(
      (history) => {
        if (live) setState({ status: 'ready', history });
      },
      (error: unknown) => {
        if (live) setState({ status: 'error', message: FiddleError.from(error).message });
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const load = (history: History, sha: string) => {
    // One load at a time: it may be waiting on the network or an unsaved-changes prompt.
    if (sha === history.activeSha || loadingSha !== null) return;
    setLoadingSha(sha);
    documentsApi.LoadGist(history.id, sha).then(onClose, (error: unknown) => {
      setLoadingSha(null);
      showToast({
        tone: 'error',
        title: t('loadFailed', { message: FiddleError.from(error).message }),
      });
    });
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('historyTitle')}
      description={t('historyDescription')}
      icon="history"
      width={480}
      closeLabel={t('close')}
      footer={
        <Button variant="ghost" onPress={onClose}>
          {t('close')}
        </Button>
      }
    >
      {state.status === 'loading' && (
        <div className={styles.status}>
          <Spinner />
        </div>
      )}
      {state.status === 'error' && (
        <p className={styles.help}>{t('historyFailed', { message: state.message })}</p>
      )}
      {state.status === 'ready' && state.history.revisions.length === 0 && (
        <p className={styles.help}>{t('historyEmpty')}</p>
      )}
      {state.status === 'ready' && state.history.revisions.length > 0 && (
        <List
          aria-label={t('historyListLabel')}
          className={styles.history}
          value={loadingSha ?? state.history.activeSha ?? null}
          onChange={(sha) => load(state.history, sha)}
        >
          {[...state.history.revisions].reverse().map((revision) => (
            <ListRow
              key={revision.sha}
              id={revision.sha}
              icon="git-branch"
              title={
                revision.n === 0
                  ? t('historyCreated')
                  : t('historyRevision', { n: revision.n })
              }
              meta={t('historyMeta', {
                sha: revision.sha.slice(0, 7),
                date: formatDate(new Date(revision.date)),
              })}
              tags={
                <>
                  {revision.sha === state.history.activeSha && (
                    <Tag tone="accent">{t('historyActive')}</Tag>
                  )}
                  <Tag>
                    {t('historyChanges', {
                      additions: revision.additions,
                      deletions: revision.deletions,
                    })}
                  </Tag>
                </>
              }
            />
          ))}
        </List>
      )}
    </Dialog>
  );
}
