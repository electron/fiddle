import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { Button, IconButton } from './Button';
import { TextField } from './TextField';
import styles from './Dialog.module.css';

export type DialogTone = 'accent' | 'warning' | 'success' | 'danger';

interface LayoutProps {
  heading: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  iconTone?: DialogTone;
  children?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  onClose?: () => void;
}

function DialogLayout({ heading, description, icon, iconTone = 'accent', children, footer, closeLabel, onClose }: LayoutProps) {
  const closable = Boolean(onClose && closeLabel);
  return (
    <>
      <div className={styles.head} data-closable={closable || undefined}>
        {icon && (
          <span className={styles.icon} data-tone={iconTone}>
            <Icon name={icon} size={18} />
          </span>
        )}
        {heading}
        {closable && <IconButton icon="close" size="sm" label={closeLabel!} onPress={onClose} />}
      </div>
      {description && <div className={styles.description}>{description}</div>}
      {children && <div className={styles.body}>{children}</div>}
      {footer && <div className={styles.footer}>{footer}</div>}
    </>
  );
}

export interface DialogSurfaceProps extends Omit<LayoutProps, 'heading'> {
  title: ReactNode;
  width?: number;
  className?: string;
}

/** The dialog panel on its own, for inline use and specimens. */
export function DialogSurface({ title, width = 420, className, ...rest }: DialogSurfaceProps) {
  return (
    <div className={cx(styles.surface, className)} style={{ maxWidth: width }}>
      <DialogLayout {...rest} heading={<h2 className={styles.title}>{title}</h2>} />
    </div>
  );
}

export interface DialogProps extends Omit<LayoutProps, 'heading' | 'onClose'> {
  title: ReactNode;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Close by clicking the scrim. Escape always closes. */
  isDismissable?: boolean;
  role?: 'dialog' | 'alertdialog';
  width?: number;
}

/** A modal dialog on overlay glass over a blurred scrim. 420 wide, radius-dialog. */
export function Dialog({ title, isOpen, onOpenChange, isDismissable = true, role, width = 420, ...rest }: DialogProps) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={isDismissable} className={styles.scrim}>
      <Modal className={styles.modal} style={{ maxWidth: width }}>
        <AriaDialog role={role} className={styles.surface}>
          {({ close }) => (
            <DialogLayout
              {...rest}
              onClose={close}
              heading={
                <Heading slot="title" className={styles.title}>
                  {title}
                </Heading>
              }
            />
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/* confirmDialog and promptDialog: promise-returning helpers rendered by one DialogHost. */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** danger makes the confirm button a danger button. */
  tone?: 'default' | 'danger';
  icon?: IconName;
  iconTone?: DialogTone;
}

export interface PromptOptions {
  title: string;
  message?: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel: string;
}

type Request =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

let current: Request | null = null;
const listeners = new Set<() => void>();

function setRequest(next: Request | null) {
  if (current && next) {
    // A new request replaces an open one; the old one counts as cancelled.
    if (current.kind === 'confirm') current.resolve(false);
    else current.resolve(null);
  }
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks a yes-or-no question. Resolves true when confirmed. Needs a mounted DialogHost. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => setRequest({ kind: 'confirm', options, resolve }));
}

/** Asks for a line of text. Resolves null when cancelled. Needs a mounted DialogHost. */
export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => setRequest({ kind: 'prompt', options, resolve }));
}

function finish(value: boolean | string | null) {
  const request = current;
  if (!request) return;
  current = null;
  if (request.kind === 'confirm') request.resolve(value === true);
  else request.resolve(typeof value === 'string' ? value : null);
  listeners.forEach((listener) => listener());
}

function PromptBody({ options }: { options: PromptOptions }) {
  const [value, setValue] = useState(options.defaultValue ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        finish(value);
      }}
    >
      <div className={styles.body}>
        <TextField
          label={options.label}
          value={value}
          onChange={setValue}
          placeholder={options.placeholder}
          autoFocus
        />
      </div>
      <div className={styles.footer}>
        <Button variant="ghost" onPress={() => finish(null)}>
          {options.cancelLabel}
        </Button>
        <Button variant="primary" type="submit">
          {options.confirmLabel}
        </Button>
      </div>
    </form>
  );
}

/** Renders the dialogs that confirmDialog and promptDialog ask for. Mount once. */
export function DialogHost() {
  const request = useSyncExternalStore(subscribe, () => current);
  const cancel = () => finish(request?.kind === 'confirm' ? false : null);
  return (
    <ModalOverlay
      isOpen={request !== null}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
      isDismissable
      className={styles.scrim}
    >
      <Modal className={styles.modal} style={{ maxWidth: 400 }}>
        {request && (
          <AriaDialog role={request.kind === 'confirm' ? 'alertdialog' : 'dialog'} className={styles.surface}>
            <div className={styles.head}>
              {request.kind === 'confirm' && request.options.icon && (
                <span className={styles.icon} data-tone={request.options.iconTone ?? 'accent'}>
                  <Icon name={request.options.icon} size={18} />
                </span>
              )}
              <Heading slot="title" className={styles.title}>
                {request.options.title}
              </Heading>
            </div>
            {request.options.message && <div className={styles.description}>{request.options.message}</div>}
            {request.kind === 'confirm' ? (
              <div className={styles.footer}>
                <Button variant="ghost" onPress={() => finish(false)}>
                  {request.options.cancelLabel}
                </Button>
                <Button
                  variant={request.options.tone === 'danger' ? 'danger' : 'primary'}
                  onPress={() => finish(true)}
                  autoFocus
                >
                  {request.options.confirmLabel}
                </Button>
              </div>
            ) : (
              <PromptBody key={request.options.title} options={request.options} />
            )}
          </AriaDialog>
        )}
      </Modal>
    </ModalOverlay>
  );
}
