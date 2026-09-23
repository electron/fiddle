// This file runs privileged code inside an Out-of-Process iframe (OOPIF)
// Do NOT import any third-party code here, and keep the code to the minimum

import './less/run-button.less';

import { PREFERS_DARK_MEDIA_QUERY } from './constants';
import {
  InstallState,
  type InstallStateEvent,
  type ProgressObject,
} from './interfaces';
import {
  type LoadedFiddleTheme,
  defaultDark,
  defaultLight,
} from './themes-defaults';
import { getCssStringForTheme } from './utils/theme';

type IsolatedRunButtonEvent =
  | 'run-fiddle'
  | 'fiddle-stopped'
  | 'fiddle-modules-installed'
  | 'version-state-changed'
  | 'version-download-progress'
  | 'theme-loaded';

declare global {
  interface Window {
    IsolatedActionsElectronFiddle: {
      startFiddle(): void;
      stopFiddle(): void;
      readThemeFile(name: string): Promise<LoadedFiddleTheme | null>;
      addEventListener(
        type: IsolatedRunButtonEvent,
        listener: (...args: any[]) => void,
        options?: { signal: AbortSignal },
      ): void;
      removeAllListeners(type: IsolatedRunButtonEvent): void;
    };
  }
}

type ButtonMode =
  | 'run'
  | 'stop'
  | 'installing-modules'
  | 'downloading'
  | 'unzipping'
  | 'checking';

interface ButtonAppearance {
  text: string;
  iconClass: string;
  showSpinner: boolean;
  disabled: boolean;
  active: boolean;
  action: 'start' | 'stop' | null;
}

interface State {
  isRunning: boolean;
  installingModules: boolean;
  installState: InstallState | undefined;
  downloadProgress: number | undefined;
  currentAppearance: ButtonAppearance;
}

const APPEARANCES: Record<ButtonMode, ButtonAppearance> = {
  run: {
    text: 'Run',
    iconClass: 'bp3-icon-play',
    showSpinner: false,
    disabled: false,
    active: false,
    action: 'start',
  },
  stop: {
    text: 'Stop',
    iconClass: 'bp3-icon-stop',
    showSpinner: false,
    disabled: false,
    active: true,
    action: 'stop',
  },
  'installing-modules': {
    text: 'Installing modules',
    iconClass: '',
    showSpinner: true,
    disabled: true,
    active: false,
    action: null,
  },
  downloading: {
    text: 'Downloading',
    iconClass: '',
    showSpinner: true,
    disabled: true,
    active: false,
    action: null,
  },
  unzipping: {
    text: 'Unzipping',
    iconClass: '',
    showSpinner: true,
    disabled: true,
    active: false,
    action: null,
  },
  checking: {
    text: 'Checking status',
    iconClass: '',
    showSpinner: true,
    disabled: true,
    active: false,
    action: null,
  },
};

const api = window.IsolatedActionsElectronFiddle;

const state: State = {
  isRunning: false,
  installingModules: false,
  installState: undefined,
  downloadProgress: undefined,
  currentAppearance: APPEARANCES.checking,
};

function computeMode(): ButtonMode {
  switch (state.installState) {
    case 'downloading':
      return 'downloading';
    case 'installing':
      return 'unzipping';
    case 'downloaded':
    case 'installed':
    default:
      if (state.installingModules) return 'installing-modules';
      if (state.isRunning) return 'stop';
      return 'run';
  }
}

const button = document.getElementById('run-button') as HTMLButtonElement;
const iconEl = document.getElementById('run-button-icon') as HTMLSpanElement;
const textEl = document.getElementById('run-button-text') as HTMLSpanElement;

// Match Blueprint's <Spinner size={16}>
const SPINNER_SIZE = 16;
const SPINNER_STROKE = 2;
const SPINNER_R = (SPINNER_SIZE - SPINNER_STROKE) / 2;
const SPINNER_C = 2 * Math.PI * SPINNER_R;

function buildSpinnerHtml(): string {
  const path = `M 8,8 m 0,-${SPINNER_R} a ${SPINNER_R},${SPINNER_R} 0 1,1 0,${
    SPINNER_R * 2
  } a ${SPINNER_R},${SPINNER_R} 0 1,1 0,-${SPINNER_R * 2}`;
  return `
    <span class="bp3-spinner bp3-small" aria-hidden="true">
      <span class="bp3-spinner-animation">
        <svg width="${SPINNER_SIZE}" height="${SPINNER_SIZE}" stroke-width="${SPINNER_STROKE}" viewBox="0 0 ${SPINNER_SIZE} ${SPINNER_SIZE}">
          <path class="bp3-spinner-track" d="${path}" opacity="0.2"></path>
          <path class="bp3-spinner-head" d="${path}" pathLength="${SPINNER_C}" stroke-dasharray="${SPINNER_C} ${SPINNER_C}"></path>
        </svg>
      </span>
    </span>
  `;
}

function updateSpinner(progress?: number) {
  // Only rebuild the DOM when transitioning into spinner mode —
  // otherwise the existing `.bp3-spinner-head` keeps its identity and
  // its `stroke-dashoffset` transition stays continuous.
  if (!iconEl.querySelector('.bp3-spinner')) {
    iconEl.className = '';
    iconEl.innerHTML = buildSpinnerHtml();
  }
  const spinner = iconEl.querySelector('.bp3-spinner');
  const head = iconEl.querySelector<SVGPathElement>('.bp3-spinner-head');
  if (!spinner || !head) return;

  const clamped =
    typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) : null;
  const offset =
    clamped === null ? SPINNER_C * 0.25 : SPINNER_C * (1 - clamped);
  head.setAttribute('stroke-dashoffset', String(offset));
  // Blueprint's spinner rotates by default via the `.bp3-spinner-animation`
  // keyframes. When we have a concrete progress value we want the
  // determinate look — head sits still and fills via the
  // `stroke-dashoffset` CSS transition — so add `bp3-no-spin` to the
  // parent to disable the rotation keyframes.
  spinner.classList.toggle('bp3-no-spin', clamped !== null);
}

function render() {
  const mode = computeMode();
  const appearance = APPEARANCES[mode];
  state.currentAppearance = appearance;

  textEl.textContent = appearance.text;

  if (appearance.showSpinner) {
    const progress =
      mode === 'downloading' ? state.downloadProgress : undefined;
    updateSpinner(progress);
  } else {
    iconEl.innerHTML = '';
    iconEl.className = `bp3-icon ${appearance.iconClass}`.trim();
  }

  button.disabled = appearance.disabled;
  button.setAttribute('aria-disabled', String(appearance.disabled));
  button.classList.toggle('bp3-disabled', appearance.disabled);
  button.classList.toggle('bp3-active', appearance.active);
  button.setAttribute('aria-label', appearance.text);
}

button.addEventListener('click', () => {
  if (state.currentAppearance.action === 'start') {
    api.startFiddle();
  } else if (state.currentAppearance.action === 'stop') {
    api.stopFiddle();
  }
});

// Forward focus state to the parent frame so it can put a focus ring on the iframe
const FOCUS_MESSAGE = 'isolated-run-button-focus';
button.addEventListener('focus', () => {
  window.parent.postMessage({ type: FOCUS_MESSAGE, value: true }, '*');
});
button.addEventListener('blur', () => {
  window.parent.postMessage({ type: FOCUS_MESSAGE, value: false }, '*');
});

api.addEventListener(
  'run-fiddle',
  ({ installingModules }: { installingModules?: boolean }) => {
    state.isRunning = true;
    state.installingModules = !!installingModules;
    render();
  },
);

api.addEventListener('fiddle-stopped', () => {
  state.isRunning = false;
  state.installingModules = false;
  render();
});

api.addEventListener('fiddle-modules-installed', () => {
  state.installingModules = false;
  render();
});

api.addEventListener('version-state-changed', (event: InstallStateEvent) => {
  state.installState = event.state as InstallState;
  if (event.state !== 'downloading') {
    state.downloadProgress = undefined;
  }
  render();
});

api.addEventListener(
  'version-download-progress',
  (_version: string, progress: ProgressObject) => {
    state.downloadProgress = progress?.percent;
    // A progress event implies we're in the middle of a download, so
    // surface that even if VERSION_STATE_CHANGED hasn't arrived yet.
    state.installState = InstallState.downloading;
    render();
  },
);

// Tell the parent how wide the button is so the iframe element matches
const RESIZE_MESSAGE = 'isolated-run-button-resize';
const reportSize = () => {
  const rect = button.getBoundingClientRect();
  window.parent.postMessage({ type: RESIZE_MESSAGE, width: rect.width }, '*');
};

new ResizeObserver(reportSize).observe(button);

const themeStyle = document.createElement('style');
themeStyle.id = 'fiddle-theme';
document.head.appendChild(themeStyle);

function applyTheme(theme: LoadedFiddleTheme) {
  themeStyle.textContent = getCssStringForTheme(theme);
  const isDark = !!theme.isDark || theme.name.toLowerCase().includes('dark');
  document.body.classList.toggle('bp3-dark', isDark);
}

const themesByName = new Map<string, LoadedFiddleTheme>([
  [defaultDark.file, defaultDark],
  [defaultLight.file, defaultLight],
]);

async function applyThemeByName(name: string | null) {
  if (!name) {
    applyTheme(defaultDark);
    return;
  }
  let theme = themesByName.get(name);
  if (!theme) {
    const loaded = await api.readThemeFile(name);
    if (loaded) {
      themesByName.set(loaded.file, loaded);
      theme = loaded;
    }
  }
  applyTheme(theme ?? defaultDark);
}

api.addEventListener('theme-loaded', (theme: LoadedFiddleTheme) => {
  themesByName.set(theme.file, theme);
});

// Initial theme state is passed as query parameters
const initialParams = new URL(location.href).searchParams;
let isUsingSystemTheme =
  initialParams.get('initialUsingSystemTheme') !== 'false';

window
  .matchMedia(PREFERS_DARK_MEDIA_QUERY)
  .addEventListener('change', ({ matches: prefersDark }) => {
    if (isUsingSystemTheme) {
      applyTheme(prefersDark ? defaultDark : defaultLight);
    }
  });

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const data = event.data as {
    type?: unknown;
    value?: unknown;
    themeName?: unknown;
  } | null;
  if (!data || typeof data.type !== 'string') return;
  if (data.type === 'isolated-run-button-using-system-theme') {
    isUsingSystemTheme = !!data.value;
    return;
  }
  if (data.type === 'isolated-run-button-theme') {
    const name = typeof data.themeName === 'string' ? data.themeName : null;
    void applyThemeByName(name);
  }
});

if (isUsingSystemTheme) {
  applyTheme(
    window.matchMedia(PREFERS_DARK_MEDIA_QUERY).matches
      ? defaultDark
      : defaultLight,
  );
} else {
  void applyThemeByName(initialParams.get('initialTheme'));
}

render();
