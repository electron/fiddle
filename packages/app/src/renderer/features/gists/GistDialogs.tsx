import { HistoryDialog } from './HistoryDialog';
import { OpenGistDialog } from './OpenGistDialog';
import { PublishDialog } from './PublishDialog';
import { SignInDialog } from './SignInDialog';
import { showGistDialog, useGistDialog } from './state';

/** Renders whichever gist dialog is open. Mounted once, by PublishButton. */
export function GistDialogs() {
  const dialog = useGistDialog();
  const close = () => showGistDialog(null);
  switch (dialog?.kind) {
    case 'sign-in':
      return <SignInDialog onClose={close} onSignedIn={dialog.then} />;
    case 'publish':
      return <PublishDialog onClose={close} />;
    case 'history':
      return <HistoryDialog onClose={close} />;
    case 'open':
      return <OpenGistDialog onClose={close} />;
    default:
      return null;
  }
}
