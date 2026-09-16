/* eslint-disable */

export interface IPCStore<T> {
  getState(): Promise<T>;
  getStateSync(): T;
  onStateChange(fn: (newState: T) => void): () => void;
}
import type { AppState } from "../../../../shared/stores.js";
export type { AppState };
import type { WindowState } from "../../../../shared/stores.js";
export type { WindowState };
export type CommandId = string;
import type { FocusContext } from "../../../../shared/settings.js";
export type { FocusContext };
export interface AppInfo {
  name: string;
  version: string;
  electronVersion: string;
}
export interface IAppImpl {
  GetAppInfo(): Promise<AppInfo> | AppInfo;
  getInitialAppState(): Promise<AppState> | AppState;
}
export interface IAppRenderer {
  GetAppInfo(): Promise<AppInfo>;
  AppStore: IPCStore<AppState>
}
export interface IWindowImpl {
  ReportReady(): Promise<void> | void;
  RunCommand(id: CommandId): Promise<void> | void;
  DoubleClickTitleBar(): Promise<void> | void;
  ReportContextMenu(context: FocusContext): Promise<void> | void;
  getInitialWindowState(): Promise<WindowState> | WindowState;
}
export interface IWindowRenderer {
  ReportReady(): Promise<void>;
  RunCommand(id: CommandId): Promise<void>;
  DoubleClickTitleBar(): Promise<void>;
  ReportContextMenu(context: FocusContext): Promise<void>;
  onCommand(fn: (id: CommandId) => void): () => void;
  WindowStore: IPCStore<WindowState>
}
import type { FileMapValue } from "../../../../shared/stores.js";
export type { FileMapValue };
import type { WindowLayout } from "../../../../shared/stores.js";
export type { WindowLayout };
import type { WindowView } from "../../../../shared/stores.js";
export type { WindowView };
export type FileName = string;
export type ShortText = string;
export interface IDocumentsImpl {
  GetFiles(): Promise<FileMapValue> | FileMapValue;
  EditFile(name: FileName, text: string, fiddleRev: number): Promise<number> | number;
  AddFile(name: FileName): Promise<number> | number;
  RenameFile(oldName: FileName, newName: FileName): Promise<number> | number;
  RemoveFile(name: FileName): Promise<number> | number;
  SetFileVisible(name: FileName, visible: boolean): Promise<number> | number;
  SetActiveFile(name: FileName): Promise<number> | number;
  SetLayout(layout: WindowLayout): Promise<number> | number;
  SetView(view: WindowView): Promise<number> | number;
  LoadGist(idOrUrl: ShortText, revision: string | null): Promise<number> | number;
  LoadExample(name: ShortText): Promise<number> | number;
  LoadDocsExample(tag: ShortText, path: ShortText): Promise<number> | number;
  OpenDropped(text: ShortText): Promise<void> | void;
}
export interface IDocumentsRenderer {
  GetFiles(): Promise<FileMapValue>;
  EditFile(name: FileName, text: string, fiddleRev: number): Promise<number>;
  AddFile(name: FileName): Promise<number>;
  RenameFile(oldName: FileName, newName: FileName): Promise<number>;
  RemoveFile(name: FileName): Promise<number>;
  SetFileVisible(name: FileName, visible: boolean): Promise<number>;
  SetActiveFile(name: FileName): Promise<number>;
  SetLayout(layout: WindowLayout): Promise<number>;
  SetView(view: WindowView): Promise<number>;
  LoadGist(idOrUrl: ShortText, revision: string | null): Promise<number>;
  LoadExample(name: ShortText): Promise<number>;
  LoadDocsExample(tag: ShortText, path: ShortText): Promise<number>;
  OpenDropped(text: ShortText): Promise<void>;
}
import type { SettingKey } from "../../../../shared/settings.js";
export type { SettingKey };
import type { SettingValue } from "../../../../shared/settings.js";
export type { SettingValue };
import type { ThemeData } from "../../../../shared/settings.js";
export type { ThemeData };
import type { ThemeSnapshot } from "../../../../shared/settings.js";
export type { ThemeSnapshot };
export type ThemeId = string;
export type NoticeId = string;
export interface ISettingsImpl {
  SetSetting(key: SettingKey, value: SettingValue): Promise<number> | number;
  ResetSetting(key: SettingKey): Promise<number> | number;
  OpenSettingsFile(): Promise<void> | void;
  ImportSettings(): Promise<number | null> | number | null;
  ExportSettings(): Promise<void> | void;
  DismissStorageNotice(id: NoticeId): Promise<number> | number;
  GetTheme(id: ThemeId): Promise<ThemeData | null> | ThemeData | null;
  RefreshThemes(): Promise<number> | number;
  ImportTheme(): Promise<number | null> | number | null;
  CreateTheme(builtin: ThemeSnapshot | null): Promise<number> | number;
  OpenThemesFolder(): Promise<void> | void;
}
export interface ISettingsRenderer {
  SetSetting(key: SettingKey, value: SettingValue): Promise<number>;
  ResetSetting(key: SettingKey): Promise<number>;
  OpenSettingsFile(): Promise<void>;
  ImportSettings(): Promise<number | null>;
  ExportSettings(): Promise<void>;
  DismissStorageNotice(id: NoticeId): Promise<number>;
  GetTheme(id: ThemeId): Promise<ThemeData | null>;
  RefreshThemes(): Promise<number>;
  ImportTheme(): Promise<number | null>;
  CreateTheme(builtin: ThemeSnapshot | null): Promise<number>;
  OpenThemesFolder(): Promise<void>;
}
import type { PackageSearchResults } from "../../../../shared/stores.js";
export type { PackageSearchResults };
import type { PackageVersions } from "../../../../shared/stores.js";
export type { PackageVersions };
export type PackageName = string;
export type PackageQuery = string;
export type VersionSpec = string;
export interface IModulesImpl {
  SearchPackages(query: PackageQuery): Promise<PackageSearchResults> | PackageSearchResults;
  GetPackageVersions(name: PackageName): Promise<PackageVersions> | PackageVersions;
  AddModule(name: PackageName, version: VersionSpec | null): Promise<number> | number;
  SetModuleVersion(name: PackageName, version: VersionSpec): Promise<number> | number;
  RemoveModule(name: PackageName): Promise<number> | number;
}
export interface IModulesRenderer {
  SearchPackages(query: PackageQuery): Promise<PackageSearchResults>;
  GetPackageVersions(name: PackageName): Promise<PackageVersions>;
  AddModule(name: PackageName, version: VersionSpec | null): Promise<number>;
  SetModuleVersion(name: PackageName, version: VersionSpec): Promise<number>;
  RemoveModule(name: PackageName): Promise<number>;
}
export interface IOnboardingImpl {
  ShouldOfferTour(): Promise<boolean> | boolean;
  SetTourDone(): Promise<void> | void;
}
export interface IOnboardingRenderer {
  ShouldOfferTour(): Promise<boolean>;
  SetTourDone(): Promise<void>;
}
import type { ReleaseList } from "../../../../shared/stores.js";
export type { ReleaseList };
import type { VersionList } from "../../../../shared/stores.js";
export type { VersionList };
import type { VersionRefValue } from "../../../../shared/stores.js";
export type { VersionRefValue };
import type { OutputLines } from "../../../../shared/stores.js";
export type { OutputLines };
import type { EditorTypes } from "../../../../shared/stores.js";
export type { EditorTypes };
export type VersionString = string;
export type BuildId = string;
export interface IVersionsImpl {
  GetReleases(): Promise<ReleaseList> | ReleaseList;
  RefreshReleases(): Promise<void> | void;
  SetVersion(ref: VersionRefValue): Promise<number> | number;
  Download(version: VersionString): Promise<void> | void;
  Remove(version: VersionString): Promise<void> | void;
  DownloadAll(versions: VersionList): Promise<void> | void;
  StopDownloadAll(): Promise<void> | void;
  DeleteAll(): Promise<void> | void;
  AddLocalBuild(): Promise<boolean> | boolean;
  RemoveLocalBuild(id: BuildId): Promise<void> | void;
  RetryDownload(): Promise<void> | void;
  CopyVersion(): Promise<void> | void;
  DismissNotice(id: number): Promise<void> | void;
  GetTypes(): Promise<EditorTypes | null> | EditorTypes | null;
}
export interface IVersionsRenderer {
  GetReleases(): Promise<ReleaseList>;
  RefreshReleases(): Promise<void>;
  SetVersion(ref: VersionRefValue): Promise<number>;
  Download(version: VersionString): Promise<void>;
  Remove(version: VersionString): Promise<void>;
  DownloadAll(versions: VersionList): Promise<void>;
  StopDownloadAll(): Promise<void>;
  DeleteAll(): Promise<void>;
  AddLocalBuild(): Promise<boolean>;
  RemoveLocalBuild(id: BuildId): Promise<void>;
  RetryDownload(): Promise<void>;
  CopyVersion(): Promise<void>;
  DismissNotice(id: number): Promise<void>;
  GetTypes(): Promise<EditorTypes | null>;
  onTypesChanged(fn: () => void): () => void;
}
export interface IRunImpl {
  GetOutput(): Promise<OutputLines> | OutputLines;
  ClearOutput(): Promise<void> | void;
  StartBisect(good: VersionString, bad: VersionString, auto: boolean): Promise<void> | void;
  BisectGood(): Promise<void> | void;
  BisectBad(): Promise<void> | void;
  BisectSkip(): Promise<void> | void;
  StopBisect(): Promise<void> | void;
  OpenBisectCompare(): Promise<void> | void;
}
export interface IRunRenderer {
  GetOutput(): Promise<OutputLines>;
  ClearOutput(): Promise<void>;
  StartBisect(good: VersionString, bad: VersionString, auto: boolean): Promise<void>;
  BisectGood(): Promise<void>;
  BisectBad(): Promise<void>;
  BisectSkip(): Promise<void>;
  StopBisect(): Promise<void>;
  OpenBisectCompare(): Promise<void>;
  onOutput(fn: (lines: OutputLines) => void): () => void;
}
export type GitHubToken = string;
export type GistDescription = string;
export type GistId = string;
export enum GitHubCredentialStorage {
  Encrypted = "encrypted",
  Weak = "weak",
  Unavailable = "unavailable",
}
export interface GitHubSignInResult {
  login: string;
  persisted: boolean;
}
export interface GistLinkInfo {
  id: string;
  url: string;
}
export interface GistRevisionInfo {
  sha: string;
  date: string;
  additions: number;
  deletions: number;
  n: number;
}
export interface GistHistoryInfo {
  id: string;
  activeSha?: string;
  revisions: GistRevisionInfo[];
}
export interface IGitHubImpl {
  GetCredentialStorage(): Promise<GitHubCredentialStorage> | GitHubCredentialStorage;
  SignIn(token: GitHubToken, allowPlaintext: boolean): Promise<GitHubSignInResult> | GitHubSignInResult;
  SignInFromClipboard(allowPlaintext: boolean): Promise<GitHubSignInResult> | GitHubSignInResult;
  SignOut(): Promise<void> | void;
  HasClipboardToken(): Promise<boolean> | boolean;
  ReadClipboardGist(): Promise<string | null> | string | null;
  OpenNewTokenPage(): Promise<void> | void;
  TakeNotice(): Promise<string | null> | string | null;
  Publish(description: GistDescription, isPublic: boolean): Promise<GistLinkInfo> | GistLinkInfo;
  Update(): Promise<GistLinkInfo> | GistLinkInfo;
  Delete(): Promise<void> | void;
  GetHistory(): Promise<GistHistoryInfo> | GistHistoryInfo;
  CopyShareLink(id: GistId): Promise<void> | void;
}
export interface IGitHubRenderer {
  GetCredentialStorage(): Promise<GitHubCredentialStorage>;
  SignIn(token: GitHubToken, allowPlaintext: boolean): Promise<GitHubSignInResult>;
  SignInFromClipboard(allowPlaintext: boolean): Promise<GitHubSignInResult>;
  SignOut(): Promise<void>;
  HasClipboardToken(): Promise<boolean>;
  ReadClipboardGist(): Promise<string | null>;
  OpenNewTokenPage(): Promise<void>;
  TakeNotice(): Promise<string | null>;
  Publish(description: GistDescription, isPublic: boolean): Promise<GistLinkInfo>;
  Update(): Promise<GistLinkInfo>;
  Delete(): Promise<void>;
  GetHistory(): Promise<GistHistoryInfo>;
  CopyShareLink(id: GistId): Promise<void>;
}
export enum LogLevel {
  info = "info",
  warn = "warn",
  error = "error",
}
export type LogText = string;
export interface IAppPlatformImpl {
  Log(level: LogLevel, message: LogText): Promise<void> | void;
  IsCrashReportingEnabled(): Promise<boolean> | boolean;
  OpenUpdatePage(): Promise<void> | void;
  TakeCrashReportsNotice(): Promise<boolean> | boolean;
  Relaunch(): Promise<void> | void;
  ResetPrivacyPermissions(): Promise<boolean> | boolean;
}
export interface IAppPlatformRenderer {
  Log(level: LogLevel, message: LogText): Promise<void>;
  IsCrashReportingEnabled(): Promise<boolean>;
  OpenUpdatePage(): Promise<void>;
  TakeCrashReportsNotice(): Promise<boolean>;
  Relaunch(): Promise<void>;
  ResetPrivacyPermissions(): Promise<boolean>;
  onUpdateAvailable(fn: (version: string) => void): () => void;
}