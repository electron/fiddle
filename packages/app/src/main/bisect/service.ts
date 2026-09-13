/**
 * Bisect (REQUIREMENTS §17.9) over the visible releases between a known-good
 * and a known-bad version.
 *
 * - Manual: each step stops the fiddle and switches the window to the version
 *   under test; the user marks it Good, Bad or Skip.
 * - Auto: runs the fiddle on each version through the normal run path (the
 *   same trust check and spawn); exit code 0 is good. Both ends are verified
 *   first, and an invalid run stops the bisect.
 */
import { Bisector, bisectCompareUrl, type BisectStep } from '../../fiddle/bisect';
import { compareVersions, getVersionRange } from '../../fiddle/versions';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { BisectState } from '../../shared/stores';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import type { RunService } from '../run/service';
import { visibleVersions } from '../versions/releases';
import type { VersionsService } from '../versions/service';

interface Session {
  auto: boolean;
  bisector?: Bisector;
  stopped: boolean;
}

export class BisectService {
  readonly #hub: StateHub;
  readonly #runs: RunService;
  readonly #versions: VersionsService;
  readonly #sessions = new Map<string, Session>();

  constructor(hub: StateHub, runs: RunService, versions: VersionsService) {
    this.#hub = hub;
    this.#runs = runs;
    this.#versions = versions;
  }

  isActive(windowId: string): boolean {
    return this.#runs.state(windowId).bisect !== null && this.#runs.state(windowId).bisect?.result === null;
  }

  async start(windowId: string, good: string, bad: string, auto: boolean): Promise<void> {
    const t = tm('mainRun');
    if (compareVersions(good, bad) >= 0) {
      throw new FiddleError(ErrorCode.invalidArgument, 'The good version must be older than the bad one');
    }
    const settings = this.#hub.app.settings;
    const visible = visibleVersions(this.#versions.releases(), settings, (v) => this.#versions.state(v) === 'installed');
    const range = getVersionRange(good, bad, visible);
    if (range.length < 2) throw new FiddleError(ErrorCode.invalidArgument, t('bisectTooFew'));
    this.stop(windowId);

    if (auto) {
      const trust = await documents.ensureTrusted(windowId, 'auto-bisect');
      if (!trust.approved) {
        this.#runs.log(windowId, t('untrusted'), 'error');
        return;
      }
      const session: Session = { auto: true, stopped: false };
      this.#sessions.set(windowId, session);
      this.#setBisect(windowId, { good, bad, auto: true, current: null, result: null });
      void this.#auto(windowId, session, range, trust.allowScripts).catch((error: unknown) => {
        log.error('auto bisect failed', error);
        this.stop(windowId);
      });
      return;
    }

    const bisector = new Bisector(range);
    this.#sessions.set(windowId, { auto: false, bisector, stopped: false });
    this.#setBisect(windowId, { good, bad, auto: false, current: null, result: null });
    await this.#show(windowId, bisector.current());
  }

  async mark(windowId: string, verdict: 'good' | 'bad' | 'skip'): Promise<void> {
    const bisector = this.#sessions.get(windowId)?.bisector;
    if (!bisector) return;
    const step = verdict === 'good' ? bisector.good() : verdict === 'bad' ? bisector.bad() : bisector.skip();
    await this.#show(windowId, step);
  }

  stop(windowId: string): void {
    const session = this.#sessions.get(windowId);
    if (session) {
      session.stopped = true;
      if (session.auto) this.#runs.stop(windowId);
    }
    this.#sessions.delete(windowId);
    if (this.#runs.state(windowId).bisect) this.#runs.setState(windowId, { bisect: null });
  }

  /** The result's compare URL, if the bisect finished. */
  compareUrl(windowId: string): string | undefined {
    const result = this.#runs.state(windowId).bisect?.result;
    return result ? bisectCompareUrl(result.good, result.bad) : undefined;
  }

  async #show(windowId: string, step: BisectStep): Promise<void> {
    const t = tm('mainRun');
    const current = this.#runs.state(windowId).bisect;
    if (!current) return;
    if (step.done) {
      this.#finish(windowId, step.good, step.bad);
      return;
    }
    // Each step stops the running fiddle and switches to the version under test.
    this.#runs.stop(windowId);
    await documents.setFiddleVersion(windowId, { kind: 'release', version: step.version });
    this.#setBisect(windowId, { ...current, current: step.version });
    this.#runs.log(windowId, t('bisectStep', { version: step.version }));
    if (this.#versions.state(step.version) !== 'installed') {
      void this.#versions.install(step.version).catch((error: unknown) => log.warn('bisect download failed', error));
    }
  }

  async #auto(windowId: string, session: Session, range: string[], allowScripts: boolean): Promise<void> {
    const t = tm('mainRun');
    const check = async (version: string): Promise<boolean | undefined> => {
      if (session.stopped) return undefined;
      const current = this.#runs.state(windowId).bisect;
      if (current) this.#setBisect(windowId, { ...current, current: version });
      this.#runs.log(windowId, t('bisectStep', { version }));
      const result = await this.#runs.run(windowId, {
        versionRef: { kind: 'release', version },
        trusted: { allowScripts },
      });
      if (session.stopped) return undefined;
      if (result === 'invalid') {
        this.#runs.log(windowId, t('bisectInvalid'), 'error');
        return undefined;
      }
      const good = result === 'success';
      this.#runs.log(windowId, good ? t('bisectVerdictGood', { version }) : t('bisectVerdictBad', { version }));
      return good;
    };

    const first = range[0]!;
    const last = range[range.length - 1]!;
    const firstGood = await check(first);
    if (firstGood !== true) return this.#abort(windowId, firstGood === false ? first : undefined);
    const lastGood = await check(last);
    if (lastGood !== false) return this.#abort(windowId, lastGood === true ? last : undefined);

    const bisector = new Bisector(range);
    let step = bisector.current();
    while (!step.done) {
      const good = await check(step.version);
      if (good === undefined) return this.#abort(windowId, undefined);
      step = good ? bisector.good() : bisector.bad();
    }
    this.#finish(windowId, step.good, step.bad);
  }

  #abort(windowId: string, unexpected: string | undefined): void {
    if (unexpected) this.#runs.log(windowId, tm('mainRun')('bisectVerifyFailed', { version: unexpected }), 'error');
    this.#sessions.delete(windowId);
    if (this.#runs.state(windowId).bisect) this.#runs.setState(windowId, { bisect: null });
  }

  #finish(windowId: string, good: string, bad: string): void {
    const current = this.#runs.state(windowId).bisect;
    this.#sessions.delete(windowId);
    if (!current) return;
    this.#setBisect(windowId, { ...current, current: null, result: { good, bad } });
    this.#runs.log(windowId, tm('mainRun')('bisectDone', { good, bad, url: bisectCompareUrl(good, bad) }));
  }

  #setBisect(windowId: string, bisect: BisectState): void {
    this.#runs.setState(windowId, { bisect });
  }
}
