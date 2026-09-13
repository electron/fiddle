import type { ReactElement } from 'react';
import styles from './Icon.module.css';
import { cx } from '../cx';

/* Lucent icons: a 16px grid, 1.4px stroke, round caps and joins, drawn in currentColor.
   Shapes come from the prototype where it has them. */
const paths = {
  play: <path d="M4.6 2.9v10.2L13 8z" fill="currentColor" stroke="none" />,
  stop: <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none" />,
  columns: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M8 3v10" />
    </>
  ),
  sidebar: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6 3v10" />
    </>
  ),
  settings: (
    <>
      <path d="M14.22 6.48 L14.22 9.52 L12.53 9.86 L12.52 9.89 L13.47 11.32 L11.32 13.47 L9.89 12.52 L9.86 12.53 L9.52 14.22 L6.48 14.22 L6.14 12.53 L6.11 12.52 L4.68 13.47 L2.53 11.32 L3.48 9.89 L3.47 9.86 L1.78 9.52 L1.78 6.48 L3.47 6.14 L3.48 6.11 L2.53 4.68 L4.68 2.53 L6.11 3.48 L6.14 3.47 L6.48 1.78 L9.52 1.78 L9.86 3.47 L9.89 3.48 L11.32 2.53 L13.47 4.68 L12.52 6.11 L12.53 6.14Z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  upload: <path d="M8 10.5V3M5 6l3-3 3 3M3 13h10" />,
  download: <path d="M8 3v7.5M5 7.5l3 3 3-3M3 13h10" />,
  'chevron-down': <path d="m4.5 6 3.5 3.5L11.5 6" />,
  'chevron-right': <path d="m6 4.5 3.5 3.5L6 11.5" />,
  'chevron-left': <path d="M10 4.5 6.5 8l3.5 3.5" />,
  'chevron-up': <path d="m4.5 10 3.5-3.5 3.5 3.5" />,
  check: <path d="m3.5 8.5 3 3 6-7" />,
  close: <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  minus: <path d="M4 8h8" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4" />
      <path d="m10 10 3 3" />
    </>
  ),
  file: (
    <>
      <path d="M4.5 2h4.5l3 3v9h-7.5z" />
      <path d="M9 2v3h3" />
    </>
  ),
  folder: (
    <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.5h4.8A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />
  ),
  package: (
    <>
      <path d="M8 1.8 13.5 5v6L8 14.2 2.5 11V5z" />
      <path d="M2.5 5 8 8.2 13.5 5M8 8.2v6" />
    </>
  ),
  popout: (
    <>
      <path d="M9.5 2.5h4v4M13.5 2.5 8 8" />
      <path d="M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
    </>
  ),
  dock: (
    <>
      <path d="M13.5 2.5 8.5 7.5M8.5 4v3.5H12" />
      <path d="M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
    </>
  ),
  error: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8v3.8M8 11v.01" />
    </>
  ),
  warning: (
    <>
      <path d="M8 2.2 14.2 13H1.8z" />
      <path d="M8 6.5v3M8 11.2v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.2V11M8 5v.01" />
    </>
  ),
  success: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="m5.5 8.2 1.8 1.8 3.3-3.8" />
    </>
  ),
  'x-circle': (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="m6 6 4 4M10 6l-4 4" />
    </>
  ),
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" />,
  refresh: <path d="M12.5 6A5 5 0 1 0 13 9.5M12.5 2.5V6H9" />,
  history: (
    <>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5" />
      <path d="M8 5v3l2 1.5" />
    </>
  ),
  lock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
    </>
  ),
  unlock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 4.9-.7" />
    </>
  ),
  link: <path d="M7 5H5.5a3 3 0 0 0 0 6H7M9 5h1.5a3 3 0 0 1 0 6H9M6 8h4" />,
  copy: (
    <>
      <rect x="5" y="5" width="8" height="8" rx="1.5" />
      <path d="M3 10.5V4a1 1 0 0 1 1-1h6.5" />
    </>
  ),
  external: (
    <>
      <path d="M9.5 2.5h4v4M13.5 2.5 8 8" />
      <path d="M12 9.5v3.5H3V4h3.5" />
    </>
  ),
  'git-branch': (
    <>
      <circle cx="4.5" cy="4" r="1.5" />
      <circle cx="4.5" cy="12" r="1.5" />
      <circle cx="11.5" cy="6" r="1.5" />
      <path d="M4.5 5.5v5M11.5 7.5c0 2.5-2 3-5 3.5" />
    </>
  ),
  'thumbs-up': (
    <path d="M5.5 7.2 7.9 2.8c.8 0 1.5.7 1.4 1.6l-.3 2.3h3.1a1.3 1.3 0 0 1 1.3 1.6l-1 4.2a1.3 1.3 0 0 1-1.3 1H5.5zM2.5 7.2h3v6.3h-3z" />
  ),
  'thumbs-down': (
    <path d="M5.5 8.8 7.9 13.2c.8 0 1.5-.7 1.4-1.6l-.3-2.3h3.1a1.3 1.3 0 0 0 1.3-1.6l-1-4.2a1.3 1.3 0 0 0-1.3-1H5.5zM2.5 8.8h3V2.5h-3z" />
  ),
  window: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 6h12" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </>
  ),
  moon: <path d="M13.2 9.6A5.5 5.5 0 0 1 6.4 2.8a5.5 5.5 0 1 0 6.8 6.8z" />,
  command: (
    <path d="M6 6H4.5A1.5 1.5 0 1 1 6 4.5V6zM10 6V4.5A1.5 1.5 0 1 1 11.5 6H10zM10 10h1.5A1.5 1.5 0 1 1 10 11.5V10zM6 10v1.5A1.5 1.5 0 1 1 4.5 10H6zM6 6h4v4H6z" />
  ),
  keyboard: (
    <>
      <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
      <path d="M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M5 9.5h6" />
    </>
  ),
  more: (
    <>
      <circle cx="4" cy="8" r=".9" fill="currentColor" />
      <circle cx="8" cy="8" r=".9" fill="currentColor" />
      <circle cx="12" cy="8" r=".9" fill="currentColor" />
    </>
  ),
  terminal: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M5 6.5 7 8l-2 1.5M8.5 10H11" />
    </>
  ),
  code: <path d="m5.5 4.5-3.5 3.5 3.5 3.5M10.5 4.5l3.5 3.5-3.5 3.5" />,
  sparkle: <path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8 6.7 6.7z" />,
  eye: (
    <>
      <path d="M1.8 8S4 3.5 8 3.5 14.2 8 14.2 8 12 12.5 8 12.5 1.8 8 1.8 8z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M6.2 3.8A6.7 6.7 0 0 1 8 3.5C12 3.5 14.2 8 14.2 8a11 11 0 0 1-1.9 2.6M9.9 9.9A2 2 0 0 1 6.1 6.1M4.1 4.9C2.6 6 1.8 8 1.8 8S4 12.5 8 12.5a6 6 0 0 0 2.9-.7" />
      <path d="m2.5 2.5 11 11" />
    </>
  ),
  maximize: <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9.5 6.5M2.5 13.5l4-4" />,
  minimize: <path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5l4-4M6.5 9.5l-4 4" />,
  pin: (
    <>
      <path d="M9.5 2.5 13.5 6.5 11 7.5 8.5 10l-.5 3-5-5 3-.5L8.5 5z" />
      <path d="m5.5 10.5-3 3" />
    </>
  ),
  book: (
    <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2H13v10H4.5A1.5 1.5 0 0 0 3 13.5zM3 13.5A1.5 1.5 0 0 0 4.5 15H13v-3" />
  ),
  filter: <path d="M2.5 3.5h11l-4.2 5v4l-2.6 1.3V8.5z" />,
  grip: (
    <>
      <circle cx="6" cy="4" r=".9" fill="currentColor" />
      <circle cx="10" cy="4" r=".9" fill="currentColor" />
      <circle cx="6" cy="8" r=".9" fill="currentColor" />
      <circle cx="10" cy="8" r=".9" fill="currentColor" />
      <circle cx="6" cy="12" r=".9" fill="currentColor" />
      <circle cx="10" cy="12" r=".9" fill="currentColor" />
    </>
  ),
  user: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </>
  ),
  palette: (
    <>
      <path d="M8 2a6 6 0 0 0 0 12c1 0 1.3-.7 1-1.4-.4-.9.2-1.6 1.1-1.6H12a2 2 0 0 0 2-2A6 6 0 0 0 8 2z" />
      <circle cx="5" cy="7" r=".8" fill="currentColor" />
      <circle cx="8" cy="5" r=".8" fill="currentColor" />
      <circle cx="11" cy="7" r=".8" fill="currentColor" />
    </>
  ),
  cloud: <path d="M4.5 12.5a3 3 0 0 1-.4-6 4 4 0 0 1 7.7-.8 3.4 3.4 0 0 1 .2 6.8z" />,
  bell: (
    <>
      <path d="M4 11V7.5a4 4 0 0 1 8 0V11l1 1.5H3z" />
      <path d="M6.5 14h3" />
    </>
  ),
  'arrow-right': <path d="M3 8h10M9 4l4 4-4 4" />,
  'arrow-left': <path d="M13 8H3M7 4 3 8l4 4" />,
  circle: <circle cx="8" cy="8" r="5.5" />,
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof paths;

/** Every icon name, in declaration order. */
export const iconNames = Object.keys(paths) as IconName[];

export interface IconProps {
  name: IconName;
  /** Rendered size in px. The artwork is drawn on a 16px grid. */
  size?: number;
  /** Accessible name. Without one the icon is decorative and hidden from assistive tech. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 16, label, className }: IconProps) {
  return (
    <svg
      className={cx(styles.icon, className)}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
