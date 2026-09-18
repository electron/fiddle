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
  /** md is 30px tall, sm is 24px. */
  size?: 'md' | 'sm';
  /** For fields that sit on the chrome, such as the sidebar search. */
  onGlass?: boolean;
  icon?: IconName;
  /** Trailing content inside the field, such as a Kbd. */
  suffix?: ReactNode;
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
  suffix,
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
        {suffix && <span className={styles.suffix}>{suffix}</span>}
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
  label?: string;
  helper?: ReactNode;
  /** Label on the left, control on the right. */
  inline?: boolean;
  isDisabled?: boolean;
  children: ReactNode;
  className?: string;
}

/** A caption label, a control and helper text, for controls that don't carry their own label. */
export function FormField({
  label,
  helper,
  inline,
  isDisabled,
  children,
  className,
}: FormFieldProps) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={label ? id : undefined}
      aria-disabled={isDisabled || undefined}
      className={cx(styles.formField, className)}
      data-inline={inline || undefined}
      data-disabled={isDisabled || undefined}
    >
      {label && (
        <div id={id} className={styles.label}>
          {label}
        </div>
      )}
      <div className={styles.control} inert={isDisabled}>
        {children}
      </div>
      {helper && <div className={styles.help}>{helper}</div>}
    </div>
  );
}
