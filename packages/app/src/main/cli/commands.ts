import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import { Installer, InstallState } from '@electron/fiddle-core';
import { app } from 'electron';

import { bisectCompareUrl } from '../../fiddle/bisect';
import { findExample, listExamples } from '../../fiddle/examples';
import { isSupportedFileName, PACKAGE_JSON, type FileMap } from '../../fiddle/files';
import { writeFiddleFolder } from '../../fiddle/folder';
import { getGistId } from '../../fiddle/gist-id';
import { DEFAULT_GIST_DESCRIPTION, GitHubClient } from '../../fiddle/github';
import {
  checkModuleSpec,
  findPackageManager,
  PM_INSTALL_URLS,
} from '../../fiddle/modules';
import { osUserName } from '../../fiddle/package-json';
import type { TemplateLoader } from '../../fiddle/templates';
import { formatOrigin, isUntrustedOrigin } from '../../fiddle/trust';
import {
  compareVersions,
  getReleaseChannel,
  getVersionRange,
} from '../../fiddle/versions';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { defaultSettings } from '../../shared/settings';
import type { ReleaseRow } from '../../shared/stores';
import { autoBisect } from '../bisect/auto';
import {
  filesForSave,
  loadElectronExample,
  loadFolder,
  loadGist,
  loadShowMe,
  saveToFolder,
  warningText,
  type LoadContext,
  type LoadedFiddle,
} from '../documents/load';
import { appTemplateLoader, staticDir } from '../documents/service';
import { gistFiles, publishGist } from '../github/service';
import { tm } from '../i18n';
import { errorMessage } from '../localize-error';
import { log } from '../log';
import { netFetch } from '../net-fetch';
import { forgeOptionsFor, forgeProject, runForgeTask } from '../packaging/service';
import { sfwPathFor } from '../platform/sfw';
import { executeRun, type RunJob } from '../run/execute';
import { bisectVerdict, classifyRun, type RunOutcome } from '../run/logic';
import { makeRunDir, removeDir, toolEnv } from '../run/process';
import { getCacheRoot, getEndpoints } from '../test-mode';
import { cachePaths, type CachePaths } from '../versions/paths';
import { visibleVersions } from '../versions/releases';
import {
  createInstaller,
  fetchReleaseList,
  installedExecPath,
  installRelease,
  mirrorsFor,
  readReleaseList,
} from '../versions/service';
import { t } from './argv';
import { fetchDownloader } from './downloader';
import type { CommandId, CommandInput } from './descriptors';
import { CliErrorCode, exitCodeForRun, type Reporter } from './output';
import { ensureTrusted, type TrustPrompt } from './trust';

const EXAMPLE_PREFIX = 'example:';
const ELECTRON_PREFIX = 'electron:';

interface Ctx {
  reporter: Reporter;
  signal: AbortSignal;
  cache: CachePaths;
  installer: Installer;
  releasesUrl: string;
  memo: {
    cached?: Promise<ReleaseRow[]>;
    fresh?: Promise<ReleaseRow[]>;
    templates?: TemplateLoader;
  };
}

/** The cached or bundled release list, as the app starts with. */
function cachedReleases(ctx: Ctx): Promise<ReleaseRow[]> {
  return (ctx.memo.cached ??= readReleaseList(ctx.cache).then((list) => list.rows));
}

/** The release list refreshed from the network, or the cached one if that fails. */
function freshReleases(ctx: Ctx): Promise<ReleaseRow[]> {
  return (ctx.memo.fresh ??= fetchReleaseList(ctx.cache, ctx.releasesUrl, netFetch).then(
    (list) => list.rows,
    (error: unknown) => {
      log.warn('refreshing the release list failed', error);
      return cachedReleases(ctx);
    },
  ));
}

/** A known release that runs here. A version the cached list lacks refreshes it once. */
async function requireRelease(ctx: Ctx, version: string): Promise<ReleaseRow[]> {
  let rows = await cachedReleases(ctx);
  if (!rows.some((r) => r.version === version)) rows = await freshReleases(ctx);
  const row = rows.find((r) => r.version === version);
  const tv = tm('mainVersions');
  if (!row) throw new FiddleError(ErrorCode.notFound, tv('versionUnknown', { version }));
  if (!row.supported)
    throw new FiddleError(ErrorCode.unavailable, tv('versionUnsupported', { version }));
  return rows;
}

/** The version new fiddles get in the app: the latest stable that runs here. */
function defaultVersion(rows: readonly ReleaseRow[]): string {
  return (
    rows.find((r) => r.supported && !r.version.includes('-'))?.version ??
    process.versions.electron
  );
}

/** A gist's Electron version is kept unless it's known not to run here: one the cached list lacks is looked up afresh when it's needed. */
const isUsable = (rows: readonly ReleaseRow[]) => (version: string) =>
  rows.find((r) => r.version === version)?.supported ?? true;

async function templates(ctx: Ctx): Promise<TemplateLoader> {
  const rows = await cachedReleases(ctx);
  return (ctx.memo.templates ??= appTemplateLoader(() => rows, { signal: ctx.signal }));
}

/** A GitHub client with `GITHUB_TOKEN`, if set. The app's stored credentials are never used. */
function github(): GitHubClient {
  const endpoints = getEndpoints();
  const token = process.env.GITHUB_TOKEN;
  return new GitHubClient({
    ...(token ? { token } : {}),
    apiBaseUrl: endpoints.githubApi,
    rawOrigins: [endpoints.gistRaw],
    fetch: netFetch,
  });
}

function authedGithub(): GitHubClient {
  if (!process.env.GITHUB_TOKEN)
    throw new FiddleError(ErrorCode.unauthorized, t('errorNoToken'));
  return github();
}

function gistIdOf(input: string): string {
  const id = getGistId(input);
  if (!id)
    throw new FiddleError(ErrorCode.invalidArgument, t('errorGistId', { id: input }));
  return id;
}

async function isDirectory(target: string): Promise<boolean> {
  return fsp.stat(target).then(
    (s) => s.isDirectory(),
    () => false,
  );
}

function report(ctx: Ctx, loaded: LoadedFiddle): LoadedFiddle {
  for (const warning of loaded.warnings) ctx.reporter.log(warningText(warning), 'warn');
  return loaded;
}

async function newContext(ctx: Ctx): Promise<LoadContext> {
  const rows = await cachedReleases(ctx);
  return { version: { kind: 'release', version: defaultVersion(rows) }, modules: {} };
}

async function requireFolder(dir: string): Promise<string> {
  const resolved = path.resolve(dir);
  if (!(await isDirectory(resolved)))
    throw new FiddleError(ErrorCode.notFound, t('errorFiddleNotFound', { fiddle: dir }));
  return resolved;
}

/** `<fiddle>`: a folder, a gist ID or URL, `example:<name>` or `electron:<tag>/<path>`. */
async function loadFiddle(
  ctx: Ctx,
  spec: string,
  revision?: string,
): Promise<LoadedFiddle> {
  const context = await newContext(ctx);
  if (spec.startsWith(EXAMPLE_PREFIX)) {
    const name = spec.slice(EXAMPLE_PREFIX.length);
    if (!findExample(name)) {
      const names = listExamples()
        .map((example) => example.name)
        .join(', ');
      throw new FiddleError(
        ErrorCode.notFound,
        t('errorUnknownExample', { name, names }),
      );
    }
    return report(ctx, await loadShowMe(staticDir(), name, context));
  }
  if (spec.startsWith(ELECTRON_PREFIX)) {
    const rest = spec.slice(ELECTRON_PREFIX.length);
    const slash = rest.indexOf('/');
    if (slash <= 0 || slash === rest.length - 1)
      throw new FiddleError(ErrorCode.invalidArgument, t('errorElectronExample'));
    const loaded = await loadElectronExample(
      github(),
      await templates(ctx),
      rest.slice(0, slash),
      rest.slice(slash + 1),
      ctx.signal,
    );
    return report(ctx, loaded);
  }
  if (await isDirectory(spec))
    return report(ctx, await loadFolder(path.resolve(spec), context));
  const id = getGistId(spec);
  if (!id)
    throw new FiddleError(ErrorCode.notFound, t('errorFiddleNotFound', { fiddle: spec }));
  const rows = await cachedReleases(ctx);
  const options = {
    context,
    confirmAddFile: async () => true,
    isUsableVersion: isUsable(rows),
  };
  return report(ctx, await loadGist(github(), id, revision, options, ctx.signal));
}

/** The fiddle's modules plus each `--module name@version` (no version: `latest`). */
export function withModules(
  loaded: LoadedFiddle,
  specs: readonly string[],
): Record<string, string> {
  const modules = { ...loaded.fiddle.modules };
  for (const spec of specs) {
    const at = spec.lastIndexOf('@');
    const [name, version] =
      at > 0 ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, 'latest'];
    if (checkModuleSpec(name, version))
      throw new FiddleError(
        ErrorCode.invalidArgument,
        t('errorInvalidModule', { module: spec }),
      );
    modules[name] = version;
  }
  return modules;
}

/** The trust prompt on the terminal: the question on stderr, the answer from stdin. Ctrl+C or `signal` cancels it. */
function terminalPrompt(signal: AbortSignal): TrustPrompt {
  return {
    get interactive() {
      return process.stdin.isTTY === true;
    },
    async ask(detail, question) {
      process.stderr.write(`${detail}\n\n`);
      const prompt = readline.createInterface({
        input: process.stdin,
        output: process.stderr,
      });
      try {
        return await prompt.question(question, { signal });
      } catch (error) {
        if ((error as Error).name === 'AbortError')
          throw new FiddleError(ErrorCode.cancelled, 'The trust prompt was cancelled');
        throw error;
      } finally {
        prompt.close();
      }
    },
  };
}

type ElectronChoice = RunJob['electron'];

/** The build folder of an executable: `<folder>/Electron.app/Contents/MacOS/Electron` on macOS, its folder elsewhere. */
function buildFolderOf(exec: string): string {
  const bundle = exec.lastIndexOf('.app/Contents/MacOS/');
  return process.platform === 'darwin' && bundle !== -1
    ? path.dirname(exec.slice(0, bundle + 4))
    : path.dirname(exec);
}

/** `--electron-path`: a local build's folder or its executable. */
async function localElectron(target: string): Promise<{ exec: string; folder: string }> {
  const resolved = path.resolve(target);
  const isDir = await isDirectory(resolved);
  const exec = isDir ? Installer.getExecPath(resolved) : resolved;
  if (!fs.existsSync(exec))
    throw new FiddleError(
      ErrorCode.notFound,
      t('errorElectronPathMissing', { path: exec }),
    );
  return { exec, folder: isDir ? resolved : buildFolderOf(exec) };
}

/** `--version`, else the fiddle's version (from its package.json), else the app's default. */
function releaseFor(
  flag: string | undefined,
  loaded: LoadedFiddle,
  rows: readonly ReleaseRow[],
): string {
  if (flag) return flag.replace(/^v/, '');
  return loaded.fiddle.version.kind === 'release'
    ? loaded.fiddle.version.version
    : defaultVersion(rows);
}

/** An installed release's executable, downloaded first if needed. */
async function releaseExec(ctx: Ctx, version: string): Promise<string> {
  const installed = installedExecPath(ctx.installer, ctx.cache, version);
  if (installed) return installed;
  ctx.reporter.log(tm('mainRun')('downloading', { version }));
  const mirror = mirrorsFor(defaultSettings, app.getSystemLocale());
  return installRelease(ctx.installer, ctx.cache, version, {
    mirror,
    signal: ctx.signal,
  });
}

async function chooseElectron(
  ctx: Ctx,
  input: { version?: string | undefined; electronPath?: string | undefined },
  loaded: LoadedFiddle,
): Promise<ElectronChoice> {
  if (input.electronPath) {
    const { exec } = await localElectron(input.electronPath);
    return { exec, label: exec };
  }
  const version = releaseFor(input.version, loaded, await cachedReleases(ctx));
  await requireRelease(ctx, version);
  return { exec: await releaseExec(ctx, version), label: version, release: version };
}

/** One run through the app's run executor, with output streamed to the reporter. */
async function runOnce(
  ctx: Ctx,
  loaded: LoadedFiddle,
  modules: Record<string, string>,
  options: Pick<CommandInput<'run'>, 'flag' | 'env' | 'pm' | 'logging'>,
  electron: ElectronChoice,
): Promise<RunOutcome> {
  const { reporter, signal } = ctx;
  signal.throwIfAborted();
  const dir = await makeRunDir();
  try {
    return await executeRun(
      {
        dir,
        files: loaded.fiddle.files,
        modules,
        name: loaded.name,
        electron,
        allowScripts: !isUntrustedOrigin(loaded.fiddle.origin),
        // The app's defaults, Socket Firewall included, with the command's options.
        settings: {
          ...defaultSettings,
          packageManager: options.pm,
          environmentVariables: [...options.env],
          electronFlags: [...options.flag],
          electronLogging: options.logging,
        },
        signal,
      },
      {
        log: (text, level) => reporter.log(text, level),
        tool: (text) => reporter.output('stderr', text),
        output: (stream, chunk) => reporter.output(stream, chunk),
        flush: () => reporter.flush(),
      },
    );
  } finally {
    await removeDir(dir);
  }
}

async function packageOrMake(
  ctx: Ctx,
  task: 'package' | 'make',
  input: CommandInput<'package'>,
): Promise<Result> {
  const tr = tm('mainRun');
  const loaded = await loadFiddle(ctx, input.fiddle);
  const modules = withModules(loaded, input.module);
  await ensureTrusted(loaded.fiddle, modules, input.trust, terminalPrompt(ctx.signal));
  const env = await toolEnv();
  if (!(await findPackageManager(input.pm, { env }))) {
    throw new FiddleError(
      ErrorCode.unavailable,
      tr('pmMissing', { pm: input.pm, url: PM_INSTALL_URLS[input.pm] }),
    );
  }
  let releases = await cachedReleases(ctx);
  let release: string | undefined;
  let localPath: string | undefined;
  if (input.electronPath) {
    localPath = (await localElectron(input.electronPath)).folder;
  } else {
    release = releaseFor(input.version, loaded, releases);
    releases = await requireRelease(ctx, release);
  }
  const project = forgeProject(
    { files: loaded.fiddle.files, modules, name: loaded.name, author: osUserName() },
    { ...(release ? { release } : {}), ...(localPath ? { localPath } : {}), releases },
  );
  ctx.signal.throwIfAborted();
  const dir = await makeRunDir(`electron-fiddle-${task}-`);
  try {
    await writeFiddleFolder(dir, project, [], { keepEmpty: true });
    ctx.reporter.log(
      task === 'package' ? tr('packaging', { path: dir }) : tr('making', { path: dir }),
    );
    const sfw = await sfwPathFor(defaultSettings.socketFirewall);
    const failed = await runForgeTask(dir, input.pm, task, {
      env,
      signal: ctx.signal,
      onOutput: (text) => ctx.reporter.output('stderr', text),
      // As for runs: a remote fiddle's install scripts stay off.
      ignoreScripts: isUntrustedOrigin(loaded.fiddle.origin),
      ...(sfw ? { sfwPath: sfw } : {}),
    });
    if (failed)
      throw new FiddleError(CliErrorCode.taskFailed, tr('commandFailed', failed), failed);
  } catch (error) {
    // The project of a failed or cancelled build is no use: don't leave its `node_modules` in the temp folder.
    await removeDir(dir);
    throw error;
  }
  const out = path.join(dir, 'out');
  return { data: { dir, out }, human: tr('packageDone', { path: out }) };
}

/** A folder's fiddle, and the files of the gist it becomes. */
async function folderGistFiles(
  ctx: Ctx,
  dir: string,
): Promise<{ loaded: LoadedFiddle; files: FileMap }> {
  const loaded = report(
    ctx,
    await loadFolder(await requireFolder(dir), await newContext(ctx)),
  );
  const { fiddle } = loaded;
  const files = gistFiles({
    files: fiddle.files,
    name: loaded.name,
    versionRef: fiddle.version,
    modules: fiddle.modules,
    source: {},
  });
  return { loaded, files };
}

interface Result {
  /** The `data` of the JSON result. */
  data: unknown;
  /** The result for people; empty when it was already printed. */
  human: string;
  /** Default 0. */
  exitCode?: number;
}

type Handlers = {
  [K in CommandId]: (ctx: Ctx, input: CommandInput<K>) => Promise<Result>;
};

const handlers: Handlers = {
  async run(ctx, input) {
    const loaded = await loadFiddle(ctx, input.fiddle);
    const modules = withModules(loaded, input.module);
    await ensureTrusted(loaded.fiddle, modules, input.trust, terminalPrompt(ctx.signal));
    const electron = await chooseElectron(ctx, input, loaded);
    const outcome = await runOnce(ctx, loaded, modules, input, electron);
    return {
      data: {
        name: loaded.name,
        origin: formatOrigin(loaded.fiddle.origin),
        version: electron.label,
        result: classifyRun(outcome) === 'success' ? 'success' : 'failure',
        exitCode: outcome.code ?? null,
        signal: outcome.signal ?? null,
      },
      human: '',
      exitCode: exitCodeForRun(outcome),
    };
  },

  async bisect(ctx, input) {
    const tr = tm('mainRun');
    const good = input.good.replace(/^v/, '');
    const bad = input.bad.replace(/^v/, '');
    if (compareVersions(good, bad) >= 0)
      throw new FiddleError(ErrorCode.invalidArgument, tr('bisectGoodNotOlder'));
    await requireRelease(ctx, good);
    const releases = await requireRelease(ctx, bad);
    const filter = {
      channels: input.channel,
      showObsolete: input.obsolete,
      showNotDownloaded: true,
    };
    const range = getVersionRange(
      good,
      bad,
      visibleVersions(releases, filter, () => true, [good, bad]),
    );
    if (range.length < 2)
      throw new FiddleError(ErrorCode.invalidArgument, tr('bisectTooFew'));

    const loaded = await loadFiddle(ctx, input.fiddle);
    const modules = withModules(loaded, input.module);
    await ensureTrusted(loaded.fiddle, modules, input.trust, terminalPrompt(ctx.signal));
    const steps: { version: string; good: boolean }[] = [];
    const result = await autoBisect(range, async (version) => {
      if (ctx.signal.aborted) return undefined;
      ctx.reporter.log(tr('bisectStep', { version }));
      let outcome: RunOutcome;
      try {
        const electron = {
          exec: await releaseExec(ctx, version),
          label: version,
          release: version,
        };
        outcome = await runOnce(ctx, loaded, modules, input, electron);
      } catch (error) {
        if (!ctx.signal.aborted) ctx.reporter.log(errorMessage(error), 'error');
        return undefined;
      }
      // A refused run or a failed spawn says nothing about the version.
      const isGood = bisectVerdict(outcome);
      if (isGood === undefined || ctx.signal.aborted) return undefined;
      ctx.reporter.log(
        isGood
          ? tr('bisectVerdictGood', { version })
          : tr('bisectVerdictBad', { version }),
      );
      steps.push({ version, good: isGood });
      return isGood;
    });
    if ('stopped' in result) {
      const message = result.unexpected
        ? tr('bisectVerifyFailed', { version: result.unexpected })
        : tr('bisectInvalid');
      throw new FiddleError(CliErrorCode.bisectFailed, message, { steps });
    }
    const url = bisectCompareUrl(result.good, result.bad);
    return {
      data: { good: result.good, bad: result.bad, url, steps },
      human: tr('bisectDone', { good: result.good, bad: result.bad, url }),
    };
  },

  async 'versions list'(ctx, input) {
    const rows = await freshReleases(ctx);
    const installed = (version: string) =>
      ctx.installer.state(version) === InstallState.installed;
    const filter = {
      channels: input.channel,
      showObsolete: input.obsolete,
      showNotDownloaded: true,
    };
    const visible = new Set(visibleVersions(rows, filter, installed));
    const versions = rows
      .filter((r) => visible.has(r.version))
      .map((r) => ({
        version: r.version,
        channel: getReleaseChannel(r.version),
        date: r.date,
        node: r.node,
        obsolete: r.obsolete,
        installed: installed(r.version),
      }));
    const width = Math.max(0, ...versions.map((v) => v.version.length));
    const lines = versions.map((v) =>
      [
        v.version.padEnd(width),
        v.channel.padEnd(7),
        v.date.slice(0, 10),
        v.installed ? t('stateInstalled') : '',
        v.obsolete ? t('stateObsolete') : '',
      ]
        .filter(Boolean)
        .join('  '),
    );
    return {
      data: { versions },
      human: lines.length > 0 ? lines.join('\n') : t('resultNoVersions'),
    };
  },

  async 'versions download'(ctx, input) {
    const version = input.version.replace(/^v/, '');
    await requireRelease(ctx, version);
    const exec = await releaseExec(ctx, version);
    return {
      data: { version, path: exec },
      human: t('resultDownloaded', { version, path: exec }),
    };
  },

  async 'versions remove'(ctx, input) {
    const version = input.version.replace(/^v/, '');
    await ctx.installer.remove(version);
    return { data: { version }, human: t('resultRemoved', { version }) };
  },

  async 'gist publish'(ctx, input) {
    const client = authedGithub();
    const { loaded, files } = await folderGistFiles(ctx, input.dir);
    const { fiddle } = loaded;
    const version =
      fiddle.version.kind === 'release' ? fiddle.version.version : undefined;
    const template = defaultSettings.gistPublishAsRevision
      ? await (await templates(ctx)).getTemplate(version)
      : undefined;
    const publishInput = {
      description: input.description ?? DEFAULT_GIST_DESCRIPTION,
      isPublic: input.public,
    };
    const saved = await publishGist(client, publishInput, files, template, (created) =>
      ctx.reporter.log(t('warnGistPartial', { url: created.url }), 'warn'),
    );
    return {
      data: { id: saved.id, url: saved.url, revision: saved.revision ?? null },
      human: t('resultGistPublished', { url: saved.url }),
    };
  },

  async 'gist update'(ctx, input) {
    const client = authedGithub();
    const id = gistIdOf(input.id);
    const { files } = await folderGistFiles(ctx, input.dir);
    // Only files a folder can hold: the gist's other files stay.
    const canDelete = (name: string) =>
      name === PACKAGE_JSON || isSupportedFileName(name);
    const saved = await client.updateGist(id, { files, canDelete }, ctx.signal);
    return {
      data: { id: saved.id, url: saved.url, revision: saved.revision ?? null },
      human: t('resultGistUpdated', { url: saved.url }),
    };
  },

  async 'gist delete'(ctx, input) {
    const client = authedGithub();
    const id = gistIdOf(input.id);
    await client.deleteGist(id, ctx.signal);
    return { data: { id }, human: t('resultGistDeleted', { id }) };
  },

  async 'gist history'(ctx, input) {
    const id = gistIdOf(input.id);
    const revisions = await github().listGistRevisions(id, ctx.signal);
    const lines = revisions.map((r) =>
      [
        r.sha,
        r.date,
        r.title.key === 'created'
          ? t('resultRevisionCreated')
          : t('resultRevisionN', { n: r.title.n }),
        `+${r.additions} -${r.deletions}`,
      ].join('  '),
    );
    return {
      data: {
        id,
        revisions: revisions.map(({ sha, date, additions, deletions, total }) => ({
          sha,
          date,
          additions,
          deletions,
          total,
        })),
      },
      human: lines.join('\n'),
    };
  },

  async export(ctx, input) {
    const loaded = await loadFiddle(ctx, input.fiddle, input.revision);
    const dir = path.resolve(input.out);
    const ref = loaded.fiddle.version;
    const forge = input.forge
      ? forgeOptionsFor({
          ...(ref.kind === 'release' ? { release: ref.version } : {}),
          releases: await cachedReleases(ctx),
        })
      : undefined;
    const save = { name: loaded.name, author: osUserName(), ...(forge ? { forge } : {}) };
    await saveToFolder(dir, loaded.fiddle, save);
    const files = Object.keys(filesForSave(loaded.fiddle, save)).sort();
    return {
      data: { name: loaded.name, dir, files },
      human: t('resultExported', { name: loaded.name, dir }),
    };
  },

  package: (ctx, input) => packageOrMake(ctx, 'package', input),
  make: (ctx, input) => packageOrMake(ctx, 'make', input),
};

/** Runs a parsed command and reports its result. Resolves with the exit code; throws on failure. */
export async function runCommand(
  id: CommandId,
  input: Record<string, unknown>,
  options: { reporter: Reporter; signal: AbortSignal },
): Promise<number> {
  const cache = cachePaths(getCacheRoot());
  const ctx: Ctx = {
    ...options,
    cache,
    // Electron downloads through net.fetch too, so the system proxy applies.
    installer: createInstaller(cache, { downloader: fetchDownloader(netFetch) }),
    releasesUrl: getEndpoints().releasesJson,
    memo: {},
  };
  const handler = handlers[id] as (ctx: Ctx, input: unknown) => Promise<Result>;
  const { data, human, exitCode } = await handler(ctx, input);
  options.reporter.result(data, human);
  return exitCode ?? 0;
}
