/**
 * Catches a render error in one region of the window (the sidebar, the sheet,
 * the shell, the palette) and shows a small error state with Reload in its
 * place, so one component's error never blanks the whole window.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { windowApi } from '../../ipc/renderer';
import { Button, EmptyState } from '../../ui';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  /** Names the region in the log. */
  region: string;
  /** Cover the whole window, for a region that is the whole window. */
  fill?: boolean;
  children: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[fiddle] the ${this.props.region} failed to render`, error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? <RegionError fill={this.props.fill ?? false} /> : this.props.children;
  }
}

function reload(): void {
  windowApi.RunCommand('view.reload').catch(() => window.location.reload());
}

function RegionError({ fill }: { fill: boolean }) {
  const { t } = useTranslation('shell');
  return (
    <div role="alert" className={styles.error} data-fill={fill || undefined}>
      <EmptyState
        icon="warning"
        title={t('regionErrorTitle')}
        action={
          <Button size="sm" variant="secondary" onPress={reload}>
            {t('regionErrorReload')}
          </Button>
        }
      >
        {t('regionErrorBody')}
      </EmptyState>
    </div>
  );
}
