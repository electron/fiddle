import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Text,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as AriaToastRegion,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { IconButton } from './Button';
import styles from './Toast.module.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

const toneIcon: Record<ToastTone, IconName> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export interface ToastProps {
  tone?: ToastTone;
  title: ReactNode;
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  closeLabel?: string;
  onClose?: () => void;
  className?: string;
}

/** A toast on its own, for inline use and specimens. Live toasts go through showToast and Toaster. */
export function Toast({ tone = 'info', title, children, actionLabel, onAction, closeLabel, onClose, className }: ToastProps) {
  return (
    <div className={cx(styles.toast, className)} data-tone={tone}>
      <Icon name={toneIcon[tone]} className={styles.icon} />
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        {children && <div className={styles.text}>{children}</div>}
        {actionLabel && (
          <AriaButton className={styles.action} onPress={onAction}>
            {actionLabel}
          </AriaButton>
        )}
      </div>
      {onClose && closeLabel && (
        <IconButton icon="close" size="sm" label={closeLabel} onPress={onClose} className={styles.close} />
      )}
    </div>
  );
}

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
export function showToast(content: ToastContent, options: { timeout?: number } = {}): string {
  const timeout = content.actionLabel ? undefined : (options.timeout ?? 5000);
  return toastQueue.add(content, { timeout });
}

export interface ToasterProps {
  /** Accessible name for the dismiss buttons. */
  closeLabel: string;
  /** Accessible name for the region. */
  'aria-label'?: string;
  queue?: ToastQueue<ToastContent>;
}

/** The toaster region: toasts stack bottom-right, 8px apart. Mount once. */
export function Toaster({ closeLabel, queue = toastQueue, ...rest }: ToasterProps) {
  return (
    <AriaToastRegion queue={queue} aria-label={rest['aria-label']} className={styles.region}>
      {({ toast }) => {
        const tone = toast.content.tone ?? 'info';
        return (
          <AriaToast toast={toast} className={styles.toast} data-tone={tone}>
            <Icon name={toneIcon[tone]} className={styles.icon} />
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
                    queue.close(toast.key);
                  }}
                >
                  {toast.content.actionLabel}
                </AriaButton>
              )}
            </AriaToastContent>
            <IconButton slot="close" icon="close" size="sm" label={closeLabel} className={styles.close} />
          </AriaToast>
        );
      }}
    </AriaToastRegion>
  );
}
