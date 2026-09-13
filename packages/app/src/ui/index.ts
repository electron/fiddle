/* Lucent: the in-house design system. Import global.css once from the renderer entry. */

import utilities from './utilities.module.css';

export { cx } from './cx';

/** Visually hidden, still read by screen readers: live regions and spoken-only text. */
export const srOnly = utilities.srOnly;
export { Icon, iconNames, type IconName, type IconProps } from './icons/Icon';

// Actions
export { Button, IconButton, type ButtonProps, type ButtonVariant, type IconButtonProps } from './components/Button';
export {
  ToolbarButton,
  ToolbarCapsule,
  type ToolbarButtonProps,
  type ToolbarCapsuleProps,
} from './components/Toolbar';

// Inputs
export { FormField, TextField, type FormFieldProps, type TextFieldProps } from './components/TextField';
export {
  Select,
  type SelectGroup,
  type SelectItems,
  type SelectOption,
  type SelectProps,
} from './components/Select';
export {
  Menu,
  MenuItem,
  MenuPopover,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  type MenuItemProps,
  type MenuPopoverProps,
  type MenuProps,
  type MenuSectionProps,
} from './components/Menu';
export {
  Checkbox,
  Radio,
  RadioGroup,
  Switch,
  type CheckboxProps,
  type RadioGroupProps,
  type RadioProps,
  type SwitchProps,
} from './components/Choice';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentOption,
} from './components/SegmentedControl';

// Navigation and structure
export { Tab, TabList, TabPanel, Tabs, type TabListProps, type TabPanelProps, type TabProps, type TabsProps } from './components/Tabs';
export { Tree, TreeRow, type TreeProps, type TreeRowProps } from './components/Tree';
export {
  Page,
  SideNav,
  type PageProps,
  type SideNavHeading,
  type SideNavItem,
  type SideNavProps,
} from './components/Page';
export { SplitHandle, type SplitHandleProps } from './components/SplitHandle';

// Labels
export {
  Badge,
  InlineCode,
  Kbd,
  Tag,
  type BadgeProps,
  type InlineCodeProps,
  type KbdProps,
  type TagProps,
  type Tone,
} from './components/Labels';

// Feedback and overlays
export { Tooltip, type TooltipProps } from './components/Tooltip';
export {
  ProgressBar,
  ProgressRing,
  Spinner,
  type ProgressBarProps,
  type ProgressRingProps,
  type SpinnerProps,
} from './components/Progress';
export {
  showToast,
  Toast,
  Toaster,
  toastQueue,
  type ToastContent,
  type ToasterProps,
  type ToastProps,
  type ToastTone,
} from './components/Toast';
export {
  confirmDialog,
  Dialog,
  DialogHost,
  DialogSurface,
  promptDialog,
  type ConfirmOptions,
  type DialogProps,
  type DialogSurfaceProps,
  type DialogTone,
  type PromptOptions,
} from './components/Dialog';
export { Popover, PopoverTrigger, type PopoverProps } from './components/Popover';
export { Callout, EmptyState, type CalloutProps, type EmptyStateProps } from './components/Callout';

// Content
export {
  Card,
  List,
  ListRow,
  StatusPill,
  Table,
  type CardProps,
  type ListProps,
  type ListRowProps,
  type StatusPillProps,
  type TableColumn,
  type TableProps,
  type TableSection,
} from './components/Content';
