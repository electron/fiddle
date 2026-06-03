import * as React from 'react';

const ISOLATED_RUN_BUTTON_ORIGIN = 'isolated-actions://run-button';
const RESIZE_MESSAGE = 'isolated-run-button-resize';
const FOCUS_MESSAGE = 'isolated-run-button-focus';

/**
 * Renders the run button as a borderless cross-origin iframe served
 * via the `isolated-actions://` scheme. This ensures the button is
 * protected from a compromised renderer and fiddles cannot be started
 * programmatically without user interaction.
 */
export class Runner extends React.Component<Record<string, never>> {
  private iframeRef = React.createRef<HTMLIFrameElement>();
  private readonly src: string;

  constructor(props: Record<string, never>) {
    super(props);
    const initialTheme = window.app?.state?.theme ?? '';
    const initialUsingSystemTheme =
      window.app?.state?.isUsingSystemTheme ?? true;
    this.src =
      `${ISOLATED_RUN_BUTTON_ORIGIN}/` +
      `?initialTheme=${encodeURIComponent(initialTheme)}` +
      `&initialUsingSystemTheme=${initialUsingSystemTheme}`;
  }

  public componentDidMount() {
    window.addEventListener('message', this.handleMessage);
  }

  public componentWillUnmount() {
    window.removeEventListener('message', this.handleMessage);
  }

  private handleMessage = (event: MessageEvent) => {
    if (event.origin !== ISOLATED_RUN_BUTTON_ORIGIN) return;
    if (event.source !== this.iframeRef.current?.contentWindow) return;
    const data = event.data as {
      type?: unknown;
      width?: unknown;
      value?: unknown;
    } | null;
    if (!data || typeof data.type !== 'string') return;

    const iframe = this.iframeRef.current;
    if (!iframe) return;

    if (data.type === RESIZE_MESSAGE) {
      // The iframe tells us the width of the content so we can resize accordingly
      if (typeof data.width === 'number' && data.width > 0) {
        iframe.style.width = `${Math.ceil(data.width)}px`;
      }
    } else if (data.type === FOCUS_MESSAGE) {
      // Focus is inside the iframe but render the focus ring on the iframe itself
      iframe.classList.toggle('has-focus', !!data.value);
    }
  };

  public render() {
    return (
      <iframe
        id="button-run"
        ref={this.iframeRef}
        className="run-button-frame"
        title="Run Fiddle"
        src={this.src}
        allow=""
        tabIndex={0}
      />
    );
  }
}
