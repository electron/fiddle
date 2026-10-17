import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getGistId, gistUrl } from '../../../fiddle/gist-id';
import { documentsApi, githubApi } from '../../../ipc/renderer';
import { FiddleError } from '../../../shared/errors';
import { Button, Dialog, TextField } from '../../../ui';
import styles from './gists.module.css';
import { useLoadedGist } from './state';

/** A gist URL or ID on the clipboard fills the empty field, selected so typing replaces it. */
export function OpenGistDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('gists');
  const loaded = useLoadedGist();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    githubApi.ReadClipboardGist().then(
      (text) => {
        // Only into a field nobody has typed in yet.
        if (!live || !text || inputRef.current?.value) return;
        setValue(text);
        setPrefilled(true);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  // Once the clipboard's text is in the field, select it, so typing replaces it.
  useEffect(() => {
    if (prefilled) inputRef.current?.select();
  }, [prefilled]);

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
          <Button
            variant="primary"
            loading={busy}
            isDisabled={!value.trim()}
            onPress={() => void open()}
          >
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
          inputRef={inputRef}
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
