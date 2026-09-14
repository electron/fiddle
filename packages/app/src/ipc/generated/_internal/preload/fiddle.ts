/* eslint-disable */

import { contextBridge, ipcRenderer } from 'electron';
export * from '../common/fiddle.js';
import type { AppState, WindowState, CommandId, FocusContext, AppInfo, IAppImpl, IAppRenderer, IWindowImpl, IWindowRenderer, FileMapValue, WindowLayout, WindowView, FileName, ShortText, IDocumentsImpl, IDocumentsRenderer, SettingKey, SettingValue, ThemeData, ThemeSnapshot, ThemeId, NoticeId, ISettingsImpl, ISettingsRenderer, PackageSearchResults, PackageVersions, PackageName, PackageQuery, VersionSpec, IModulesImpl, IModulesRenderer, IOnboardingImpl, IOnboardingRenderer, ReleaseList, VersionList, VersionRefValue, OutputLines, EditorTypes, VersionString, BuildId, IVersionsImpl, IVersionsRenderer, IRunImpl, IRunRenderer, GitHubToken, GistDescription, GistId, GitHubCredentialStorage, GitHubSignInResult, GistLinkInfo, GistRevisionInfo, GistHistoryInfo, IGitHubImpl, IGitHubRenderer, LogLevel, LogText, IAppPlatformImpl, IAppPlatformRenderer } from '../common/fiddle.js';
import { $eipc_validator$_AppState, $eipc_validator$_WindowState, $eipc_validator$_CommandId, $eipc_validator$_FocusContext, $eipc_validator$_AppInfo, $eipc_validator$_FileMapValue, $eipc_validator$_WindowLayout, $eipc_validator$_WindowView, $eipc_validator$_FileName, $eipc_validator$_ShortText, $eipc_validator$_SettingKey, $eipc_validator$_SettingValue, $eipc_validator$_ThemeData, $eipc_validator$_ThemeSnapshot, $eipc_validator$_ThemeId, $eipc_validator$_NoticeId, $eipc_validator$_PackageSearchResults, $eipc_validator$_PackageVersions, $eipc_validator$_PackageName, $eipc_validator$_PackageQuery, $eipc_validator$_VersionSpec, $eipc_validator$_ReleaseList, $eipc_validator$_VersionList, $eipc_validator$_VersionRefValue, $eipc_validator$_OutputLines, $eipc_validator$_EditorTypes, $eipc_validator$_VersionString, $eipc_validator$_BuildId, $eipc_validator$_GitHubToken, $eipc_validator$_GistDescription, $eipc_validator$_GistId, $eipc_validator$_GitHubCredentialStorage, $eipc_validator$_GitHubSignInResult, $eipc_validator$_GistLinkInfo, $eipc_validator$_GistRevisionInfo, $eipc_validator$_GistHistoryInfo, $eipc_validator$_LogLevel, $eipc_validator$_LogText } from '../common-runtime/fiddle.js';
const $$ipcPrefix$$ = '$eipc_message$_b11a9a76-e74d-942f-513b-85e22e05269e_$_fiddle_$_';
import { webFrame } from "electron/renderer";
function $eipc_event_validator$_MainFrame() {
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return false;
  }
  if ((((("frameToken" in webFrame && webFrame.top && "frameToken" in webFrame.top) ? webFrame.top.frameToken === webFrame.frameToken : webFrame.top?.routingId === webFrame.routingId) === true) && ((((url.origin === "null" || url.origin === null ? `${url.protocol}//${url.host}` : url.origin)) === "app://main") || ((true) && ((url.protocol) === "http:") && ((url.hostname) === "localhost"))))) return true;
  return false;
}
export const App: Partial<IAppRenderer> = {
  GetAppInfo() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'App_$_GetAppInfo');
  },
  AppStore: {
    getState(): Promise<AppState> {
      return ipcRenderer.invoke($$ipcPrefix$$ + 'App_$_App_$store$_getState');
    },
    getStateSync(): AppState {
      const response = ipcRenderer.sendSync($$ipcPrefix$$ + 'App_$_App_$store$_getStateSync');
      if (response.error) throw new Error(response.error);
      return response.result;
    },
    onStateChange(fn: (newState: AppState) => void): () => void {
      const handler = (_e: unknown, newState: AppState) => fn(newState);
      const $$channel$$ = $$ipcPrefix$$ + 'App_$_App_$store$_update';
      ipcRenderer.on($$channel$$, handler);
      return () => { ipcRenderer.removeListener($$channel$$, handler); };
    },
  },
}
const $eipc_impl$__init_App = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['App'] = App
};
export const Window: Partial<IWindowRenderer> = {
  ReportReady() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Window_$_ReportReady');
  },
  RunCommand(id: CommandId) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Window_$_RunCommand', id);
  },
  DoubleClickTitleBar() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Window_$_DoubleClickTitleBar');
  },
  ReportContextMenu(context: FocusContext) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Window_$_ReportContextMenu', context);
  },
  onCommand(fn: (id: CommandId) => void) {
    const handler = (e: unknown, id: CommandId) => fn(id);
    const $$channel$$ = $$ipcPrefix$$ + 'Window_$_Command';
    ipcRenderer.on($$channel$$, handler)
    return () => { ipcRenderer.removeListener($$channel$$, handler); };
  },
  WindowStore: {
    getState(): Promise<WindowState> {
      return ipcRenderer.invoke($$ipcPrefix$$ + 'Window_$_Window_$store$_getState');
    },
    getStateSync(): WindowState {
      const response = ipcRenderer.sendSync($$ipcPrefix$$ + 'Window_$_Window_$store$_getStateSync');
      if (response.error) throw new Error(response.error);
      return response.result;
    },
    onStateChange(fn: (newState: WindowState) => void): () => void {
      const handler = (_e: unknown, newState: WindowState) => fn(newState);
      const $$channel$$ = $$ipcPrefix$$ + 'Window_$_Window_$store$_update';
      ipcRenderer.on($$channel$$, handler);
      return () => { ipcRenderer.removeListener($$channel$$, handler); };
    },
  },
}
const $eipc_impl$__init_Window = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['Window'] = Window
};
export const Documents: Partial<IDocumentsRenderer> = {
  GetFiles() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_GetFiles');
  },
  EditFile(name: FileName, text: string, fiddleRev: number) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_EditFile', name, text, fiddleRev);
  },
  AddFile(name: FileName) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_AddFile', name);
  },
  RenameFile(oldName: FileName, newName: FileName) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_RenameFile', oldName, newName);
  },
  RemoveFile(name: FileName) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_RemoveFile', name);
  },
  SetFileVisible(name: FileName, visible: boolean) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_SetFileVisible', name, visible);
  },
  SetActiveFile(name: FileName) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_SetActiveFile', name);
  },
  SetLayout(layout: WindowLayout) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_SetLayout', layout);
  },
  SetView(view: WindowView) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_SetView', view);
  },
  LoadGist(idOrUrl: ShortText, revision: string | null) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_LoadGist', idOrUrl, revision);
  },
  LoadExample(name: ShortText) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_LoadExample', name);
  },
  LoadDocsExample(tag: ShortText, path: ShortText) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_LoadDocsExample', tag, path);
  },
  OpenDropped(text: ShortText) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Documents_$_OpenDropped', text);
  },
}
const $eipc_impl$__init_Documents = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['Documents'] = Documents
};
export const Settings: Partial<ISettingsRenderer> = {
  SetSetting(key: SettingKey, value: SettingValue) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_SetSetting', key, value);
  },
  ResetSetting(key: SettingKey) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_ResetSetting', key);
  },
  OpenSettingsFile() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_OpenSettingsFile');
  },
  ImportSettings() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_ImportSettings');
  },
  ExportSettings() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_ExportSettings');
  },
  DismissStorageNotice(id: NoticeId) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_DismissStorageNotice', id);
  },
  GetTheme(id: ThemeId) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_GetTheme', id);
  },
  RefreshThemes() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_RefreshThemes');
  },
  ImportTheme() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_ImportTheme');
  },
  CreateTheme(builtin: ThemeSnapshot | null) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_CreateTheme', builtin);
  },
  OpenThemesFolder() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Settings_$_OpenThemesFolder');
  },
}
const $eipc_impl$__init_Settings = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['Settings'] = Settings
};
export const Modules: Partial<IModulesRenderer> = {
  SearchPackages(query: PackageQuery) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Modules_$_SearchPackages', query);
  },
  GetPackageVersions(name: PackageName) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Modules_$_GetPackageVersions', name);
  },
  AddModule(name: PackageName, version: VersionSpec | null) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Modules_$_AddModule', name, version);
  },
  SetModuleVersion(name: PackageName, version: VersionSpec) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Modules_$_SetModuleVersion', name, version);
  },
  RemoveModule(name: PackageName) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Modules_$_RemoveModule', name);
  },
}
const $eipc_impl$__init_Modules = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['Modules'] = Modules
};
export const Onboarding: Partial<IOnboardingRenderer> = {
  ShouldOfferTour() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Onboarding_$_ShouldOfferTour');
  },
  SetTourDone() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Onboarding_$_SetTourDone');
  },
}
const $eipc_impl$__init_Onboarding = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['Onboarding'] = Onboarding
};
export const Versions: Partial<IVersionsRenderer> = {
  GetReleases() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_GetReleases');
  },
  RefreshReleases() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_RefreshReleases');
  },
  SetVersion(ref: VersionRefValue) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_SetVersion', ref);
  },
  Download(version: VersionString) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_Download', version);
  },
  Remove(version: VersionString) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_Remove', version);
  },
  DownloadAll(versions: VersionList) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_DownloadAll', versions);
  },
  StopDownloadAll() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_StopDownloadAll');
  },
  DeleteAll() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_DeleteAll');
  },
  AddLocalBuild() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_AddLocalBuild');
  },
  RemoveLocalBuild(id: BuildId) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_RemoveLocalBuild', id);
  },
  RetryDownload() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_RetryDownload');
  },
  CopyVersion() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_CopyVersion');
  },
  DismissNotice(id: number) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_DismissNotice', id);
  },
  GetTypes() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Versions_$_GetTypes');
  },
  onTypesChanged(fn: () => void) {
    const handler = (e: unknown, ) => fn();
    const $$channel$$ = $$ipcPrefix$$ + 'Versions_$_TypesChanged';
    ipcRenderer.on($$channel$$, handler)
    return () => { ipcRenderer.removeListener($$channel$$, handler); };
  },
}
const $eipc_impl$__init_Versions = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['Versions'] = Versions
};
export const Run: Partial<IRunRenderer> = {
  GetOutput() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Run_$_GetOutput');
  },
  ClearOutput() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Run_$_ClearOutput');
  },
  onOutput(fn: (lines: OutputLines) => void) {
    const handler = (e: unknown, lines: OutputLines) => fn(lines);
    const $$channel$$ = $$ipcPrefix$$ + 'Run_$_Output';
    ipcRenderer.on($$channel$$, handler)
    return () => { ipcRenderer.removeListener($$channel$$, handler); };
  },
  StartBisect(good: VersionString, bad: VersionString, auto: boolean) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Run_$_StartBisect', good, bad, auto);
  },
  BisectGood() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Run_$_BisectGood');
  },
  BisectBad() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Run_$_BisectBad');
  },
  BisectSkip() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Run_$_BisectSkip');
  },
  StopBisect() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Run_$_StopBisect');
  },
  OpenBisectCompare() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'Run_$_OpenBisectCompare');
  },
}
const $eipc_impl$__init_Run = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['Run'] = Run
};
export const GitHub: Partial<IGitHubRenderer> = {
  GetCredentialStorage() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_GetCredentialStorage');
  },
  SignIn(token: GitHubToken, allowPlaintext: boolean) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_SignIn', token, allowPlaintext);
  },
  SignInFromClipboard(allowPlaintext: boolean) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_SignInFromClipboard', allowPlaintext);
  },
  SignOut() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_SignOut');
  },
  HasClipboardToken() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_HasClipboardToken');
  },
  OpenNewTokenPage() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_OpenNewTokenPage');
  },
  TakeNotice() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_TakeNotice');
  },
  Publish(description: GistDescription, isPublic: boolean) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_Publish', description, isPublic);
  },
  Update() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_Update');
  },
  Delete() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_Delete');
  },
  GetHistory() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_GetHistory');
  },
  CopyShareLink(id: GistId) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'GitHub_$_CopyShareLink', id);
  },
}
const $eipc_impl$__init_GitHub = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['GitHub'] = GitHub
};
export const AppPlatform: Partial<IAppPlatformRenderer> = {
  Log(level: LogLevel, message: LogText) {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'AppPlatform_$_Log', level, message);
  },
  IsCrashReportingEnabled() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'AppPlatform_$_IsCrashReportingEnabled');
  },
  OpenUpdatePage() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'AppPlatform_$_OpenUpdatePage');
  },
  TakeCrashReportsNotice() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'AppPlatform_$_TakeCrashReportsNotice');
  },
  Relaunch() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'AppPlatform_$_Relaunch');
  },
  ResetPrivacyPermissions() {
    return ipcRenderer.invoke($$ipcPrefix$$ + 'AppPlatform_$_ResetPrivacyPermissions');
  },
  onUpdateAvailable(fn: (version: string) => void) {
    const handler = (e: unknown, version: string) => fn(version);
    const $$channel$$ = $$ipcPrefix$$ + 'AppPlatform_$_UpdateAvailable';
    ipcRenderer.on($$channel$$, handler)
    return () => { ipcRenderer.removeListener($$channel$$, handler); };
  },
}
const $eipc_impl$__init_AppPlatform = (localBridged: Record<string, any>) => {
  if (!(($eipc_event_validator$_MainFrame()))) return;
  localBridged['fiddle'] = localBridged['fiddle'] || {};
  localBridged['fiddle']['AppPlatform'] = AppPlatform
};

// Initialize context bridge
const $$bridged$$ = {} as Record<string, any>;
$eipc_impl$__init_App($$bridged$$);
$eipc_impl$__init_Window($$bridged$$);
$eipc_impl$__init_Documents($$bridged$$);
$eipc_impl$__init_Settings($$bridged$$);
$eipc_impl$__init_Modules($$bridged$$);
$eipc_impl$__init_Onboarding($$bridged$$);
$eipc_impl$__init_Versions($$bridged$$);
$eipc_impl$__init_Run($$bridged$$);
$eipc_impl$__init_GitHub($$bridged$$);
$eipc_impl$__init_AppPlatform($$bridged$$);
for (const [key, value] of Object.entries($$bridged$$)) {
  contextBridge.exposeInMainWorld(key, value);
}
