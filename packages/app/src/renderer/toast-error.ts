import { FiddleError } from '../shared/errors';
import { showToast } from '../ui';

/** Shows a failure as an error toast: `title` with the error's message under it, or the message alone. */
export function toastError(error: unknown, title?: string): void {
  const message = FiddleError.from(error).message;
  showToast(
    title
      ? { tone: 'error', title, description: message }
      : { tone: 'error', title: message },
  );
}
