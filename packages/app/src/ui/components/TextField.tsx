import { useId, type CSSProperties, type ReactNode, type Ref } from 'react';
import {
  FieldError,
  Input,
  Label,
  Text,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import styles from './Field.module.css';

export interface TextFieldProps extends Omit<
  AriaTextFieldProps,
  'className' | 'children' | 'style'
> {
  label?: string;
  description?: string;
  /** Shown below the field in spark when the field is invalid. */
  errorMessage?: string;
  placeholder?: string;
  size?: 'md' | 'sm';
  /** For fields that sit on the chrome, such as the sidebar search. */
  onGlass?: boolean;
  icon?: IconName;
  mono?: boolean;
  /** The `<input>`, e.g. to select its text. */
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
  style?: CSSProperties;
}

export function TextField({
  label,
  description,
  errorMessage,
  placeholder,
  size = 'md',
  onGlass,
  icon,
  mono,
  inputRef,
  className,
  style,
  ...rest
}: TextFieldProps) {
  return (
    <AriaTextField
      {...rest}
      className={cx(styles.root, className)}
      style={style}
      data-size={size}
      data-glass={onGlass || undefined}
    >
      {label && <Label className={styles.label}>{label}</Label>}
      <div className={styles.field}>
        {icon && (
          <Icon name={icon} size={size === 'sm' ? 14 : 16} className={styles.icon} />
        )}
        <Input
          ref={inputRef}
          className={cx(styles.input, mono && styles.mono)}
          placeholder={placeholder}
        />
      </div>
      {description && (
        <Text slot="description" className={styles.help}>
          {description}
        </Text>
      )}
      <FieldError className={cx(styles.help, styles.error)}>{errorMessage}</FieldError>
    </AriaTextField>
  );
}

export interface FormFieldProps {
  label: string;
  children: ReactNode;
}

/** A caption label on the left of a control that doesn't carry its own label. */
export function FormField({ label, children }: FormFieldProps) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={styles.formField}>
      <div id={id} className={styles.label}>
        {label}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
