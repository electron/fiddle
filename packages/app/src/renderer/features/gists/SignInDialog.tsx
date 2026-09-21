import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { githubApi } from '../../../ipc/renderer';
import { ErrorCode, FiddleError } from '../../../shared/errors';
import { Button, Callout, Checkbox, Dialog, showToast, TextField } from '../../../ui';
import { toastError } from '../../toast-error';
import type { GistT } from './actions';
import styles from './gists.module.css';

function signInError(t: GistT, error: unknown): string {
  const e = FiddleError.from(error);
  const reason = (e.details as { reason?: unknown } | undefined)?.reason;
  if (reason === 'bad-format') return t('signInErrorFormat');
  if (reason === 'invalid-token') return t('signInErrorInvalid');
  if (reason === 'missing-scope') return t('signInErrorScope');
  if (e.code === ErrorCode.network || e.code === ErrorCode.unavailable)
    return t('signInErrorNetwork');
  return t('signInErrorOther', { message: e.message });
}

export interface SignInDialogProps {
  onClose: () => void;
  /** Called after a successful sign-in, once the dialog has closed. */
  onSignedIn?: () => void;
}

/** A token on the clipboard is used when the field is left empty; main reads it, so the renderer never sees it. */
export function SignInDialog({ onClose, onSignedIn }: SignInDialogProps) {
  const { t } = useTranslation('gists');
  const [token, setToken] = useState('');
  const [clipboardToken, setClipboardToken] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<string>('encrypted');
  const [remember, setRemember] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    let live = true;
    mounted.current = true;
    githubApi.HasClipboardToken().then(
      (has) => {
        if (live) setClipboardToken(has);
      },
      () => undefined,
    );
    githubApi.GetCredentialStorage().then(
      (kind) => {
        if (live) setStorage(String(kind));
      },
      () => undefined,
    );
    return () => {
      live = false;
      mounted.current = false;
    };
  }, []);

  const fromClipboard = clipboardToken && token.trim() === '';
  const canSubmit = (token.trim().length > 0 || fromClipboard) && !busy;
  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(undefined);
    try {
      const allowPlaintext = storage === 'weak' && remember;
      const result = fromClipboard
        ? await githubApi.SignInFromClipboard(allowPlaintext)
        : await githubApi.SignIn(token.trim(), allowPlaintext);
      showToast({
        tone: 'success',
        title: t('signedIn', { login: result.login }),
        description: result.persisted ? undefined : t('signedInSession'),
      });
      // Cancelling while the sign-in was in flight also cancels what it was for.
      if (mounted.current) {
        onClose();
        onSignedIn?.();
      }
    } catch (e) {
      setError(signInError(t, e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('signInTitle')}
      description={t('signInDescription')}
      icon="user"
      closeLabel={t('close')}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            isDisabled={!token.trim() && !fromClipboard}
            onPress={() => void submit()}
          >
            {t('signInSubmit')}
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label={t('signInTokenLabel')}
          type="password"
          mono
          autoFocus
          value={token}
          onChange={(value) => {
            setToken(value);
            setError(undefined);
          }}
          {...(fromClipboard ? { description: t('signInClipboardHint') } : {})}
          isInvalid={error !== undefined}
          errorMessage={error}
        />
        <Button
          variant="ghost"
          size="sm"
          icon="external"
          className={styles.tokenLink}
          onPress={() => githubApi.OpenNewTokenPage().catch(toastError)}
        >
          {t('signInCreateToken')}
        </Button>
        {storage === 'weak' && (
          <>
            <Checkbox isSelected={remember} onChange={setRemember}>
              {t('signInRemember')}
            </Checkbox>
            <p className={styles.help}>{t('signInRememberHelp')}</p>
          </>
        )}
        {storage === 'unavailable' && <Callout>{t('signInSessionOnly')}</Callout>}
      </form>
    </Dialog>
  );
}
