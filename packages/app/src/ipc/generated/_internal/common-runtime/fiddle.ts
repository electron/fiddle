/* eslint-disable */

import { appStateSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_AppState(value: unknown) {
  return appStateSchema.safeParse(value).success;
}
import { windowStateSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_WindowState(value: unknown) {
  return windowStateSchema.safeParse(value).success;
}
export function $eipc_validator$_CommandId(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 100)) return false;
  return true;
}
import { focusContextSchema } from "../../../../shared/settings.js";
export function $eipc_validator$_FocusContext(value: unknown) {
  return focusContextSchema.safeParse(value).success;
}
export function $eipc_validator$_MenuItemId(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 300)) return false;
  return true;
}
import { fileMapSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_FileMapValue(value: unknown) {
  return fileMapSchema.safeParse(value).success;
}
import { windowLayoutSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_WindowLayout(value: unknown) {
  return windowLayoutSchema.safeParse(value).success;
}
import { windowViewSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_WindowView(value: unknown) {
  return windowViewSchema.safeParse(value).success;
}
export function $eipc_validator$_FileName(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 255)) return false;
  return true;
}
export function $eipc_validator$_ShortText(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 2048)) return false;
  return true;
}
import { settingKeySchema } from "../../../../shared/settings.js";
export function $eipc_validator$_SettingKey(value: unknown) {
  return settingKeySchema.safeParse(value).success;
}
import { settingValueSchema } from "../../../../shared/settings.js";
export function $eipc_validator$_SettingValue(value: unknown) {
  return settingValueSchema.safeParse(value).success;
}
import { themeDataSchema } from "../../../../shared/settings.js";
export function $eipc_validator$_ThemeData(value: unknown) {
  return themeDataSchema.safeParse(value).success;
}
import { themeSnapshotSchema } from "../../../../shared/settings.js";
export function $eipc_validator$_ThemeSnapshot(value: unknown) {
  return themeSnapshotSchema.safeParse(value).success;
}
export function $eipc_validator$_ThemeId(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 100)) return false;
  return true;
}
export function $eipc_validator$_NoticeId(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 100)) return false;
  return true;
}
import { packageSearchResultsSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_PackageSearchResults(value: unknown) {
  return packageSearchResultsSchema.safeParse(value).success;
}
import { packageVersionsSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_PackageVersions(value: unknown) {
  return packageVersionsSchema.safeParse(value).success;
}
export function $eipc_validator$_PackageName(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 214)) return false;
  return true;
}
export function $eipc_validator$_PackageQuery(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 214)) return false;
  return true;
}
export function $eipc_validator$_VersionSpec(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 256)) return false;
  return true;
}
import { releaseListSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_ReleaseList(value: unknown) {
  return releaseListSchema.safeParse(value).success;
}
import { versionListSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_VersionList(value: unknown) {
  return versionListSchema.safeParse(value).success;
}
import { versionRefSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_VersionRefValue(value: unknown) {
  return versionRefSchema.safeParse(value).success;
}
import { outputLinesSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_OutputLines(value: unknown) {
  return outputLinesSchema.safeParse(value).success;
}
import { editorTypesSchema } from "../../../../shared/stores.js";
export function $eipc_validator$_EditorTypes(value: unknown) {
  return editorTypesSchema.safeParse(value).success;
}
export function $eipc_validator$_VersionString(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 100)) return false;
  return true;
}
export function $eipc_validator$_BuildId(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 100)) return false;
  return true;
}
export function $eipc_validator$_GitHubToken(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 255)) return false;
  return true;
}
export function $eipc_validator$_GistDescription(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 1)) return false;
if (!(value.length <= 256)) return false;
  return true;
}
export function $eipc_validator$_GistId(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 32)) return false;
if (!(value.length <= 32)) return false;
  return true;
}
const $eipc_validator$_GitHubCredentialStorage_values = new Set(["encrypted","weak","unavailable"]);
export function $eipc_validator$_GitHubCredentialStorage(value: any): boolean {
  return $eipc_validator$_GitHubCredentialStorage_values.has(value);
}
export function $eipc_validator$_GitHubSignInResult(value: any): boolean {
  if (!value || typeof value !== 'object') return false;

  // GitHubSignInResult.login
  if (!(typeof value.login === 'string')) return false;

  // GitHubSignInResult.persisted
  if (!(typeof value.persisted === 'boolean')) return false;
  return true;
}
export function $eipc_validator$_GistLinkInfo(value: any): boolean {
  if (!value || typeof value !== 'object') return false;

  // GistLinkInfo.id
  if (!(typeof value.id === 'string')) return false;

  // GistLinkInfo.url
  if (!(typeof value.url === 'string')) return false;
  return true;
}
export function $eipc_validator$_GistRevisionInfo(value: any): boolean {
  if (!value || typeof value !== 'object') return false;

  // GistRevisionInfo.sha
  if (!(typeof value.sha === 'string')) return false;

  // GistRevisionInfo.date
  if (!(typeof value.date === 'string')) return false;

  // GistRevisionInfo.additions
  if (!(typeof value.additions === 'number')) return false;

  // GistRevisionInfo.deletions
  if (!(typeof value.deletions === 'number')) return false;

  // GistRevisionInfo.n
  if (!(typeof value.n === 'number')) return false;
  return true;
}
export function $eipc_validator$_GistHistoryInfo(value: any): boolean {
  if (!value || typeof value !== 'object') return false;

  // GistHistoryInfo.id
  if (!(typeof value.id === 'string')) return false;

  // GistHistoryInfo.activeSha
  if (typeof value.activeSha !== 'undefined') {
    if (!(typeof value.activeSha === 'string')) return false;
  }

  // GistHistoryInfo.revisions
  if (!(Array.isArray(value.revisions) && value.revisions.every((v: any) => $eipc_validator$_GistRevisionInfo(v)))) return false;
  return true;
}
const $eipc_validator$_LogLevel_values = new Set(["info","warn","error"]);
export function $eipc_validator$_LogLevel(value: any): boolean {
  return $eipc_validator$_LogLevel_values.has(value);
}
export function $eipc_validator$_LogText(value: any): boolean {
if (typeof value !== 'string') return false;
if (!(value.length >= 0)) return false;
if (!(value.length <= 10000)) return false;
  return true;
}