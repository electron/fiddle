import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getGistId, gistUrl } from '../../../fiddle/gist-id';
import { documentsApi } from '../../../ipc/renderer';
import { FiddleError } from '../../../shared/errors';
import { Button, Dialog, TextField } from '../../../ui';
import styles from './gists.module.css';
import { useLoadedGist } from './state';

/** Loads a gist by URL or ID through Documents. Mount it only while it's open. */
export function OpenGistDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('gists');
  const loaded = useLoadedGist();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const valid = getGistId(value) !== null;
  const invalidMessage = touched && !valid ? t('openInvalid') : undefined;

  const open = async () => {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await documentsApi.LoadGist(value.trim(), null);
      onClose();
    } catch (e) {
      setError(t('loadFailed', { message: FiddleError.from(e).message }));
      setBusy(false);
    }
  };

  const message = error ?? invalidMessage;
  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t('openTitle')}
      icon="link"
      closeLabel={t('close')}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" loading={busy} isDisabled={!value.trim()} onPress={() => void open()}>
            {t('openSubmit')}
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void open();
        }}
      >
        <TextField
          label={t('openLabel')}
          placeholder={t('openPlaceholder')}
          description={loaded ? t('openCurrent', { url: gistUrl(loaded.id) }) : undefined}
          autoFocus
          value={value}
          onChange={(next) => {
            setValue(next);
            setError(undefined);
          }}
          onBlur={() => setTouched(value.trim() !== '')}
          isInvalid={message !== undefined}
          errorMessage={message}
        />
      </form>
    </Dialog>
  );
}
