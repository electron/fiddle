import React, { PropsWithChildren } from 'react';

type TestIdContainerProps = PropsWithChildren<{
  testId: string;
}>;

/**
 * A wrapper for third-party components that don't allow us to pass arbitrary
 * DOM attributes like `data-testid`. It uses `display: contents` in the
 * wrapping `div` so it has no CSS side effects.
 */
export function TestIdContainer({ testId, children }: TestIdContainerProps) {
  return (
    <div data-testid={testId} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
