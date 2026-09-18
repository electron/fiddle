import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { githubApi } from '../../../ipc/renderer';
import { Button, Dialog, Radio, RadioGroup, TextField } from '../../../ui';
import { reportGistError, showGistSaved } from './actions';
import styles from './gists.module.css';
import { useGistSettings } from './state';

const MAX_DESCRIPTION = 256;

/** Description and visibility for a new gist. Mount it only while it's open. */
export function PublishDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('gists');
  const settings = useGistSettings();
  const [description, setDescription] = useState<string>(() =>
    t('publishDefaultDescription'),
  );
  const [visibility, setVisibility] = useState<'secret' | 'public'>(
    settings.isPublic ? 'public' : 'secret',
  );
  const [busy, setBusy] = useState(false);

  const trimmed = description.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= MAX_DESCRIPTION;

  const publish = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const link = await githubApi.Publish(trimmed, visibility === 'public');
      onClose();
      showGistSaved(t, 'published', link.id);
    } catch (error) {
      setBusy(false);
      reportGistError(t, 'publish', error, () => void publish());
    }
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('publishTitle')}
      icon="upload"
      closeLabel={t('close')}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            isDisabled={!valid}
            onPress={() => void publish()}
          >
            {t('publishSubmit')}
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
      >
        <TextField
          label={t('publishDescriptionLabel')}
          autoFocus
          value={description}
          onChange={setDescription}
          isInvalid={!valid}
          errorMessage={t('publishDescriptionError')}
        />
        <RadioGroup
          label={t('publishVisibilityLabel')}
          description={t('publishVisibilityHelp')}
          orientation="horizontal"
          value={visibility}
          onChange={(value) => setVisibility(value === 'public' ? 'public' : 'secret')}
        >
          <Radio value="secret">{t('visibilitySecret')}</Radio>
          <Radio value="public">{t('visibilityPublic')}</Radio>
        </RadioGroup>
      </form>
    </Dialog>
  );
}
