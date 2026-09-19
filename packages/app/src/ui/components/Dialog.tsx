import { useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components';
import { Icon, type IconName } from '../icons/Icon';
import { Button, IconButton } from './Button';
import { TextField } from './TextField';
import styles from './Dialog.module.css';

export type DialogTone = 'accent' | 'warning' | 'success' | 'danger';

export interface DialogProps {
  title: ReactNode;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  description?: ReactNode;
  icon?: IconName;
  iconTone?: DialogTone;
  children?: ReactNode;
  footer?: ReactNode;
  /** Adds a close button in the header, named by this. Escape always closes. */
  closeLabel?: string;
  /** Close by clicking the scrim. */
  isDismissable?: boolean;
  role?: 'dialog' | 'alertdialog';
  width?: number;
}

export function Dialog({
  title,
  isOpen,
  onOpenChange,
  description,
  icon,
  iconTone = 'accent',
  children,
  footer,
  closeLabel,
  isDismissable = true,
  role,
  width = 420,
}: DialogProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className={styles.scrim}
    >
      <Modal className={styles.modal} style={{ maxWidth: width }}>
        <AriaDialog role={role} className={styles.surface}>
          {({ close }) => (
            <>
              <div className={styles.head} data-closable={closeLabel ? '' : undefined}>
                {icon && (
                  <span className={styles.icon} data-tone={iconTone}>
                    <Icon name={icon} size={18} />
                  </span>
                )}
                <Heading slot="title" className={styles.title}>
                  {title}
                </Heading>
                {closeLabel && (
                  <IconButton icon="close" size="sm" label={closeLabel} onPress={close} />
                )}
              </div>
              {description && <div className={styles.description}>{description}</div>}
              {children && <div className={styles.body}>{children}</div>}
              {footer && <div className={styles.footer}>{footer}</div>}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** danger makes the confirm button a danger button, and focuses Cancel rather than it. */
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
  | {
      id: number;
      kind: 'confirm';
      options: ConfirmOptions;
      resolve: (ok: boolean) => void;
    }
  | {
      id: number;
      kind: 'prompt';
      options: PromptOptions;
      resolve: (value: string | null) => void;
    };

let current: Request | null = null;
let nextRequestId = 0;
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
  return new Promise((resolve) =>
    setRequest({ id: nextRequestId++, kind: 'confirm', options, resolve }),
  );
}

/** Asks for a line of text. Resolves null when cancelled. Needs a mounted DialogHost. */
export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) =>
    setRequest({ id: nextRequestId++, kind: 'prompt', options, resolve }),
  );
}

function finish(value: boolean | string | null) {
  const request = current;
  if (!request) return;
  current = null;
  if (request.kind === 'confirm') request.resolve(value === true);
  else request.resolve(typeof value === 'string' ? value : null);
  listeners.forEach((listener) => listener());
}

function PromptField({ options, formId }: { options: PromptOptions; formId: string }) {
  const [value, setValue] = useState(options.defaultValue ?? '');
  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        finish(value);
      }}
    >
      <TextField
        label={options.label}
        value={value}
        onChange={setValue}
        placeholder={options.placeholder}
        autoFocus
      />
    </form>
  );
}

/** Renders the dialogs that confirmDialog and promptDialog ask for. Mount once. */
export function DialogHost() {
  const request = useSyncExternalStore(subscribe, () => current);
  if (!request) return null;
  const common = {
    isOpen: true,
    title: request.options.title,
    description: request.options.message,
    onOpenChange: (open: boolean) => {
      if (!open) finish(null);
    },
  };
  // Both dialogs are keyed by request, so a replacing prompt starts from its own default.
  if (request.kind === 'prompt') {
    const formId = `prompt-${request.id}`;
    return (
      <Dialog
        key={request.id}
        {...common}
        footer={
          <>
            <Button variant="ghost" onPress={() => finish(null)}>
              {request.options.cancelLabel}
            </Button>
            <Button variant="primary" type="submit" form={formId}>
              {request.options.confirmLabel}
            </Button>
          </>
        }
      >
        <PromptField options={request.options} formId={formId} />
      </Dialog>
    );
  }
  const danger = request.options.tone === 'danger';
  return (
    <Dialog
      key={request.id}
      {...common}
      role="alertdialog"
      icon={request.options.icon}
      iconTone={request.options.iconTone}
      footer={
        <>
          <Button variant="ghost" onPress={() => finish(false)} autoFocus={danger}>
            {request.options.cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onPress={() => finish(true)}
            autoFocus={!danger}
          >
            {request.options.confirmLabel}
          </Button>
        </>
      }
    />
  );
}
