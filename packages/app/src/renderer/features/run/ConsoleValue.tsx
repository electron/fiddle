import { Fragment } from 'react';

import { isExpandable, previewTokens } from '../../../shared/console-preview';
import type { ConsoleValue } from '../../../shared/stores';
import styles from './Console.module.css';

/** A value's one-line preview, coloured by type. */
function Preview({ value, top = false }: { value: ConsoleValue; top?: boolean }) {
  return previewTokens(value, top).map((token, index) =>
    token.type ? (
      <span key={index} className={styles.token} data-type={token.type}>
        {token.text}
      </span>
    ) : (
      <Fragment key={index}>{token.text}</Fragment>
    ),
  );
}

/**
 * A console argument as DevTools shows it: an object is a collapsed preview
 * that opens to its properties, each of which can be opened in turn.
 */
export function ConsoleValueView({
  value,
  label,
  separator = ': ',
}: {
  value: ConsoleValue;
  /** The property name, for a value inside an object. */
  label?: string;
  separator?: string;
}) {
  const head = (
    <>
      {label !== undefined && (
        <>
          <span className={styles.token} data-type="key">
            {label}
          </span>
          {separator}
        </>
      )}
      <Preview value={value} top={label === undefined} />
    </>
  );
  if (!isExpandable(value)) return <span className={styles.value}>{head}</span>;
  const childSeparator = value.type === 'map' ? ' => ' : ': ';
  return (
    <details className={styles.value}>
      <summary className={styles.summary}>{head}</summary>
      <ul className={styles.props}>
        {value.props?.map(([key, item], index) => (
          <li key={index}>
            <ConsoleValueView value={item} label={key} separator={childSeparator} />
          </li>
        ))}
        {(value.more ?? 0) > 0 && (
          <li className={styles.token} data-type="more">
            …
          </li>
        )}
      </ul>
    </details>
  );
}
