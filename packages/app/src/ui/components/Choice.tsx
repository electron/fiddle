import type { ReactNode } from 'react';
import {
  Checkbox as AriaCheckbox,
  Label,
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  Switch as AriaSwitch,
  Text,
  type CheckboxProps as AriaCheckboxProps,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
  type SwitchProps as AriaSwitchProps,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon } from '../icons/Icon';
import field from './Field.module.css';
import styles from './Choice.module.css';

export interface CheckboxProps extends Omit<AriaCheckboxProps, 'children' | 'className'> {
  children?: ReactNode;
  className?: string;
}

export function Checkbox({ children, className, ...rest }: CheckboxProps) {
  return (
    <AriaCheckbox {...rest} className={cx(styles.choice, className)}>
      {({ isSelected, isIndeterminate }) => (
        <>
          <span className={styles.box} aria-hidden="true">
            {isIndeterminate ? (
              <Icon name="minus" size={12} />
            ) : isSelected ? (
              <Icon name="check" size={12} />
            ) : null}
          </span>
          {children != null && <span className={styles.text}>{children}</span>}
        </>
      )}
    </AriaCheckbox>
  );
}

export interface RadioGroupProps extends Omit<
  AriaRadioGroupProps,
  'children' | 'className'
> {
  label?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function RadioGroup({
  label,
  description,
  children,
  className,
  orientation = 'vertical',
  ...rest
}: RadioGroupProps) {
  return (
    <AriaRadioGroup
      {...rest}
      orientation={orientation}
      className={cx(styles.group, className)}
    >
      {label && <Label className={field.label}>{label}</Label>}
      <div className={styles.options}>{children}</div>
      {description && (
        <Text slot="description" className={field.help}>
          {description}
        </Text>
      )}
    </AriaRadioGroup>
  );
}

export interface RadioProps extends Omit<AriaRadioProps, 'children' | 'className'> {
  children?: ReactNode;
  className?: string;
}

export function Radio({ children, className, ...rest }: RadioProps) {
  return (
    <AriaRadio {...rest} className={cx(styles.choice, styles.radio, className)}>
      <span className={styles.box} aria-hidden="true" />
      {children != null && <span className={styles.text}>{children}</span>}
    </AriaRadio>
  );
}

export interface SwitchProps extends Omit<AriaSwitchProps, 'children' | 'className'> {
  children?: ReactNode;
  className?: string;
}

export function Switch({ children, className, ...rest }: SwitchProps) {
  return (
    <AriaSwitch {...rest} className={cx(styles.choice, styles.switch, className)}>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.knob} />
      </span>
      {children != null && <span className={styles.text}>{children}</span>}
    </AriaSwitch>
  );
}
