import {
  Button as AriaButton,
  Text,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as AriaToastRegion,
} from 'react-aria-components';
import { Icon } from '../icons/Icon';
import { IconButton } from './Button';
import styles from './Toast.module.css';

/** Also the name of the tone's icon. */
export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastContent {
  tone?: ToastTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** The app's toast queue. */
export const toastQueue = new ToastQueue<ToastContent>({ maxVisibleToasts: 5 });

/** Shows a toast. Toasts with an action never time out; others close after 5s by default. */
export function showToast(
  content: ToastContent,
  options: { timeout?: number } = {},
): string {
  const timeout = content.actionLabel ? undefined : (options.timeout ?? 5000);
  return toastQueue.add(content, { timeout });
}

export interface ToasterProps {
  /** Accessible name for the dismiss buttons. */
  closeLabel: string;
  /** Accessible name for the region. Required: react-aria's default isn't from the catalog. */
  'aria-label': string;
}

/** The toaster region. Mount once. */
export function Toaster({ closeLabel, ...rest }: ToasterProps) {
  return (
    <AriaToastRegion
      queue={toastQueue}
      aria-label={rest['aria-label']}
      className={styles.region}
    >
      {({ toast }) => {
        const tone = toast.content.tone ?? 'info';
        return (
          <AriaToast toast={toast} className={styles.toast} data-tone={tone}>
            <Icon name={tone} className={styles.icon} />
            <AriaToastContent className={styles.body}>
              <Text slot="title" className={styles.title}>
                {toast.content.title}
              </Text>
              {toast.content.description && (
                <Text slot="description" className={styles.text}>
                  {toast.content.description}
                </Text>
              )}
              {toast.content.actionLabel && (
                <AriaButton
                  className={styles.action}
                  onPress={() => {
                    toast.content.onAction?.();
                    toastQueue.close(toast.key);
                  }}
                >
                  {toast.content.actionLabel}
                </AriaButton>
              )}
            </AriaToastContent>
            <IconButton
              slot="close"
              icon="close"
              size="sm"
              label={closeLabel}
              className={styles.close}
            />
          </AriaToast>
        );
      }}
    </AriaToastRegion>
  );
}
