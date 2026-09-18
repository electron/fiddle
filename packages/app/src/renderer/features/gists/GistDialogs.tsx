import { HistoryDialog } from './HistoryDialog';
import { OpenGistDialog } from './OpenGistDialog';
import { PublishDialog } from './PublishDialog';
import { SignInDialog } from './SignInDialog';
import { closeGistDialog, useGistDialog } from './state';

/** Renders whichever gist dialog is open. Mounted once, by PublishButton. */
export function GistDialogs() {
  const dialog = useGistDialog();
  if (!dialog) return null;
  const close = () => closeGistDialog(dialog);
  switch (dialog.kind) {
    case 'sign-in':
      return <SignInDialog onClose={close} onSignedIn={dialog.then} />;
    case 'publish':
      return <PublishDialog onClose={close} />;
    case 'history':
      return <HistoryDialog onClose={close} />;
    case 'open':
      return <OpenGistDialog onClose={close} />;
  }
}
