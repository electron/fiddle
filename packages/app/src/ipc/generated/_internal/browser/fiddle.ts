/* eslint-disable */

import { app as $$app$$ } from 'electron';
export * from '../common/fiddle.js';
import type { AppState, WindowState, CommandId, FocusContext, AppInfo, IAppImpl, IAppRenderer, IWindowImpl, IWindowRenderer, FileMapValue, WindowLayout, WindowView, FileName, ShortText, IDocumentsImpl, IDocumentsRenderer, SettingKey, SettingValue, ThemeData, ThemeSnapshot, ThemeId, NoticeId, ISettingsImpl, ISettingsRenderer, PackageSearchResults, PackageVersions, PackageName, PackageQuery, VersionSpec, IModulesImpl, IModulesRenderer, IOnboardingImpl, IOnboardingRenderer, ReleaseList, VersionList, VersionRefValue, OutputLines, EditorTypes, VersionString, BuildId, IVersionsImpl, IVersionsRenderer, IRunImpl, IRunRenderer, GitHubToken, GistDescription, GistId, GitHubCredentialStorage, GitHubSignInResult, GistLinkInfo, GistRevisionInfo, GistHistoryInfo, IGitHubImpl, IGitHubRenderer, LogLevel, LogText, IAppPlatformImpl, IAppPlatformRenderer } from '../common/fiddle.js';
import { $eipc_validator$_AppState, $eipc_validator$_WindowState, $eipc_validator$_CommandId, $eipc_validator$_FocusContext, $eipc_validator$_AppInfo, $eipc_validator$_FileMapValue, $eipc_validator$_WindowLayout, $eipc_validator$_WindowView, $eipc_validator$_FileName, $eipc_validator$_ShortText, $eipc_validator$_SettingKey, $eipc_validator$_SettingValue, $eipc_validator$_ThemeData, $eipc_validator$_ThemeSnapshot, $eipc_validator$_ThemeId, $eipc_validator$_NoticeId, $eipc_validator$_PackageSearchResults, $eipc_validator$_PackageVersions, $eipc_validator$_PackageName, $eipc_validator$_PackageQuery, $eipc_validator$_VersionSpec, $eipc_validator$_ReleaseList, $eipc_validator$_VersionList, $eipc_validator$_VersionRefValue, $eipc_validator$_OutputLines, $eipc_validator$_EditorTypes, $eipc_validator$_VersionString, $eipc_validator$_BuildId, $eipc_validator$_GitHubToken, $eipc_validator$_GistDescription, $eipc_validator$_GistId, $eipc_validator$_GitHubCredentialStorage, $eipc_validator$_GitHubSignInResult, $eipc_validator$_GistLinkInfo, $eipc_validator$_GistRevisionInfo, $eipc_validator$_GistHistoryInfo, $eipc_validator$_LogLevel, $eipc_validator$_LogText } from '../common-runtime/fiddle.js';
import * as $eipc$ from '../browser-runtime.js';
const $$ipcPrefix$$ = '$eipc_message$_2a2d6839-2103-b7db-b9f8-2e28b59832cd_$_fiddle_$_';
// Interfaces are declared as data and wired up by ../browser-runtime.ts:
//   methods: [name, [[argName, validator], ...], resultValidator?]  ([Sync] methods append null|validator, 'sync')
//   stores:  [name, stateValidator]
//   events:  [name, [[argName, validator], ...]]
function $eipc_event_validator$_MainFrame(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  if (!event.senderFrame) return false;
  if (!event.senderFrame.url) return false;
  let url: URL;
  try {
    url = new URL(event.senderFrame.url);
  } catch {
    return false;
  }
  if ((((event.senderFrame?.parent === null) === true) && ((((url.origin === "null" || url.origin === null ? `${url.protocol}//${url.host}` : url.origin)) === "app://main") || ((($$app$$.isPackaged) === false) && ((url.protocol) === "http:") && ((url.hostname) === "localhost"))))) return true;
  return false;
}
export interface IAppDispatcher {
  updateAppStore(state: AppState): void;
}
export const App = /*#__PURE__*/ $eipc$.defineInterface<IAppImpl, IAppRenderer, IAppDispatcher>($$ipcPrefix$$, 'App', $eipc_event_validator$_MainFrame, {
  methods: [
    ['GetAppInfo', [], $eipc_validator$_AppInfo],
  ],
  stores: [
    ['App', $eipc_validator$_AppState],
  ],
});
export interface IWindowDispatcher {
  dispatchCommand(arg_id: CommandId): void;
  updateWindowStore(state: WindowState): void;
}
export const Window = /*#__PURE__*/ $eipc$.defineInterface<IWindowImpl, IWindowRenderer, IWindowDispatcher>($$ipcPrefix$$, 'Window', $eipc_event_validator$_MainFrame, {
  methods: [
    ['ReportReady', []],
    ['RunCommand', [['id', $eipc_validator$_CommandId]]],
    ['DoubleClickTitleBar', []],
    ['ReportContextMenu', [['context', $eipc_validator$_FocusContext]]],
  ],
  stores: [
    ['Window', $eipc_validator$_WindowState],
  ],
  events: [
    ['Command', [['id', $eipc_validator$_CommandId]]],
  ],
});
export interface IDocumentsDispatcher {
}
export const Documents = /*#__PURE__*/ $eipc$.defineInterface<IDocumentsImpl, IDocumentsRenderer, IDocumentsDispatcher>($$ipcPrefix$$, 'Documents', $eipc_event_validator$_MainFrame, {
  methods: [
    ['GetFiles', [], $eipc_validator$_FileMapValue],
    ['EditFile', [['name', $eipc_validator$_FileName], ['text', $eipc$.string], ['fiddleRev', $eipc$.number]], $eipc$.number],
    ['AddFile', [['name', $eipc_validator$_FileName]], $eipc$.number],
    ['RenameFile', [['oldName', $eipc_validator$_FileName], ['newName', $eipc_validator$_FileName]], $eipc$.number],
    ['RemoveFile', [['name', $eipc_validator$_FileName]], $eipc$.number],
    ['SetFileVisible', [['name', $eipc_validator$_FileName], ['visible', $eipc$.boolean]], $eipc$.number],
    ['SetActiveFile', [['name', $eipc_validator$_FileName]], $eipc$.number],
    ['MoveFile', [['name', $eipc_validator$_FileName], ['before', $eipc$.nullable($eipc_validator$_FileName)]], $eipc$.number],
    ['SetLayout', [['layout', $eipc_validator$_WindowLayout]], $eipc$.number],
    ['SetView', [['view', $eipc_validator$_WindowView]], $eipc$.number],
    ['LoadGist', [['idOrUrl', $eipc_validator$_ShortText], ['revision', $eipc$.nullable($eipc$.string)]], $eipc$.number],
    ['LoadExample', [['name', $eipc_validator$_ShortText]], $eipc$.number],
    ['LoadDocsExample', [['tag', $eipc_validator$_ShortText], ['path', $eipc_validator$_ShortText]], $eipc$.number],
    ['OpenDropped', [['text', $eipc_validator$_ShortText]]],
  ],
});
export interface ISettingsDispatcher {
}
export const Settings = /*#__PURE__*/ $eipc$.defineInterface<ISettingsImpl, ISettingsRenderer, ISettingsDispatcher>($$ipcPrefix$$, 'Settings', $eipc_event_validator$_MainFrame, {
  methods: [
    ['SetSetting', [['key', $eipc_validator$_SettingKey], ['value', $eipc_validator$_SettingValue]], $eipc$.number],
    ['ResetSetting', [['key', $eipc_validator$_SettingKey]], $eipc$.number],
    ['OpenSettingsFile', []],
    ['ImportSettings', [], $eipc$.nullable($eipc$.number)],
    ['ExportSettings', []],
    ['DismissStorageNotice', [['id', $eipc_validator$_NoticeId]], $eipc$.number],
    ['GetTheme', [['id', $eipc_validator$_ThemeId]], $eipc$.nullable($eipc_validator$_ThemeData)],
    ['RefreshThemes', [], $eipc$.number],
    ['ImportTheme', [], $eipc$.nullable($eipc$.number)],
    ['CreateTheme', [['builtin', $eipc$.nullable($eipc_validator$_ThemeSnapshot)]], $eipc$.number],
    ['OpenThemesFolder', []],
  ],
});
export interface IModulesDispatcher {
}
export const Modules = /*#__PURE__*/ $eipc$.defineInterface<IModulesImpl, IModulesRenderer, IModulesDispatcher>($$ipcPrefix$$, 'Modules', $eipc_event_validator$_MainFrame, {
  methods: [
    ['SearchPackages', [['query', $eipc_validator$_PackageQuery]], $eipc_validator$_PackageSearchResults],
    ['GetPackageVersions', [['name', $eipc_validator$_PackageName]], $eipc_validator$_PackageVersions],
    ['AddModule', [['name', $eipc_validator$_PackageName], ['version', $eipc$.nullable($eipc_validator$_VersionSpec)]], $eipc$.number],
    ['SetModuleVersion', [['name', $eipc_validator$_PackageName], ['version', $eipc_validator$_VersionSpec]], $eipc$.number],
    ['RemoveModule', [['name', $eipc_validator$_PackageName]], $eipc$.number],
  ],
});
export interface IOnboardingDispatcher {
}
export const Onboarding = /*#__PURE__*/ $eipc$.defineInterface<IOnboardingImpl, IOnboardingRenderer, IOnboardingDispatcher>($$ipcPrefix$$, 'Onboarding', $eipc_event_validator$_MainFrame, {
  methods: [
    ['ShouldOfferTour', [], $eipc$.boolean],
    ['SetTourDone', []],
  ],
});
export interface IVersionsDispatcher {
  dispatchTypesChanged(): void;
}
export const Versions = /*#__PURE__*/ $eipc$.defineInterface<IVersionsImpl, IVersionsRenderer, IVersionsDispatcher>($$ipcPrefix$$, 'Versions', $eipc_event_validator$_MainFrame, {
  methods: [
    ['GetReleases', [], $eipc_validator$_ReleaseList],
    ['RefreshReleases', []],
    ['SetVersion', [['ref', $eipc_validator$_VersionRefValue]], $eipc$.number],
    ['Download', [['version', $eipc_validator$_VersionString]]],
    ['Remove', [['version', $eipc_validator$_VersionString]]],
    ['DownloadAll', [['versions', $eipc_validator$_VersionList]]],
    ['StopDownloadAll', []],
    ['DeleteAll', []],
    ['AddLocalBuild', [], $eipc$.boolean],
    ['RemoveLocalBuild', [['id', $eipc_validator$_BuildId]]],
    ['RetryDownload', []],
    ['CopyVersion', []],
    ['DismissNotice', [['id', $eipc$.number]]],
    ['GetTypes', [], $eipc$.nullable($eipc_validator$_EditorTypes)],
  ],
  events: [
    ['TypesChanged', []],
  ],
});
export interface IRunDispatcher {
  dispatchOutput(arg_lines: OutputLines): void;
}
export const Run = /*#__PURE__*/ $eipc$.defineInterface<IRunImpl, IRunRenderer, IRunDispatcher>($$ipcPrefix$$, 'Run', $eipc_event_validator$_MainFrame, {
  methods: [
    ['GetOutput', [], $eipc_validator$_OutputLines],
    ['ClearOutput', []],
    ['StartBisect', [['good', $eipc_validator$_VersionString], ['bad', $eipc_validator$_VersionString], ['auto', $eipc$.boolean]]],
    ['BisectGood', []],
    ['BisectBad', []],
    ['BisectSkip', []],
    ['StopBisect', []],
    ['OpenBisectCompare', []],
  ],
  events: [
    ['Output', [['lines', $eipc_validator$_OutputLines]]],
  ],
});
export interface IGitHubDispatcher {
}
export const GitHub = /*#__PURE__*/ $eipc$.defineInterface<IGitHubImpl, IGitHubRenderer, IGitHubDispatcher>($$ipcPrefix$$, 'GitHub', $eipc_event_validator$_MainFrame, {
  methods: [
    ['GetCredentialStorage', [], $eipc_validator$_GitHubCredentialStorage],
    ['SignIn', [['token', $eipc_validator$_GitHubToken], ['allowPlaintext', $eipc$.boolean]], $eipc_validator$_GitHubSignInResult],
    ['SignInFromClipboard', [['allowPlaintext', $eipc$.boolean]], $eipc_validator$_GitHubSignInResult],
    ['SignOut', []],
    ['HasClipboardToken', [], $eipc$.boolean],
    ['ReadClipboardGist', [], $eipc$.nullable($eipc$.string)],
    ['OpenNewTokenPage', []],
    ['TakeNotice', [], $eipc$.nullable($eipc$.string)],
    ['Publish', [['description', $eipc_validator$_GistDescription], ['isPublic', $eipc$.boolean]], $eipc_validator$_GistLinkInfo],
    ['Update', [], $eipc_validator$_GistLinkInfo],
    ['Delete', []],
    ['GetHistory', [], $eipc_validator$_GistHistoryInfo],
    ['CopyShareLink', [['id', $eipc_validator$_GistId]]],
  ],
});
export interface IAppPlatformDispatcher {
  dispatchUpdateAvailable(arg_version: string): void;
}
export const AppPlatform = /*#__PURE__*/ $eipc$.defineInterface<IAppPlatformImpl, IAppPlatformRenderer, IAppPlatformDispatcher>($$ipcPrefix$$, 'AppPlatform', $eipc_event_validator$_MainFrame, {
  methods: [
    ['Log', [['level', $eipc_validator$_LogLevel], ['message', $eipc_validator$_LogText]]],
    ['IsCrashReportingEnabled', [], $eipc$.boolean],
    ['OpenUpdatePage', []],
    ['TakeCrashReportsNotice', [], $eipc$.boolean],
    ['Relaunch', []],
    ['ResetPrivacyPermissions', [], $eipc$.boolean],
  ],
  events: [
    ['UpdateAvailable', [['version', $eipc$.string]]],
  ],
});