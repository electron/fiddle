import { Bisector, bisectCompareUrl, type BisectStep } from '../../fiddle/bisect';
import { compareVersions, getVersionRange } from '../../fiddle/versions';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { BisectState } from '../../shared/stores';
import * as documents from '../documents/service';
import { tm } from '../i18n';
import { log } from '../log';
import type { StateHub } from '../state-hub';
import type { RunService } from '../run/service';
import { bisectVerdict } from '../run/logic';
import { visibleVersions } from '../versions/releases';
import type { VersionsService } from '../versions/service';
import { autoBisect } from './auto';

interface Session {
  auto: boolean;
  bisector?: Bisector;
  stopped: boolean;
  /** A version is loading: a verdict now would be for the version before it. */
  stepping?: boolean;
}

export class BisectService {
  readonly #hub: StateHub;
  readonly #runs: RunService;
  readonly #versions: VersionsService;
  readonly #typesChanged: (windowId: string) => void;
  readonly #sessions = new Map<string, Session>();

  constructor(
    hub: StateHub,
    runs: RunService,
    versions: VersionsService,
    typesChanged: (windowId: string) => void,
  ) {
    this.#hub = hub;
    this.#runs = runs;
    this.#versions = versions;
    this.#typesChanged = typesChanged;
  }

  isActive(windowId: string): boolean {
    return (
      this.#runs.state(windowId).bisect !== null &&
      this.#runs.state(windowId).bisect?.result === null
    );
  }

  async start(windowId: string, good: string, bad: string, auto: boolean): Promise<void> {
    const t = tm('mainRun');
    if (compareVersions(good, bad) >= 0) {
      throw new FiddleError(ErrorCode.invalidArgument, t('bisectGoodNotOlder'));
    }
    const settings = this.#hub.app.settings;
    const visible = visibleVersions(this.#versions.releases(), settings, (v) =>
      this.#versions.isInstalled(v),
    );
    const range = getVersionRange(good, bad, visible);
    if (range.length < 2)
      throw new FiddleError(ErrorCode.invalidArgument, t('bisectTooFew'));
    this.stop(windowId);

    if (auto) {
      const trust = await documents.ensureTrusted(windowId, 'auto-bisect');
      if (!trust.approved) {
        this.#runs.log(windowId, t('untrusted'), 'error');
        return;
      }
      await this.#runs.stopAndWait(windowId);
      const session: Session = { auto: true, stopped: false };
      this.#sessions.set(windowId, session);
      this.#setBisect(windowId, { good, bad, auto: true, current: null, result: null });
      void this.#auto(windowId, session, range).catch((error: unknown) => {
        log.error('auto bisect failed', error);
        if (this.#sessions.get(windowId) !== session) return;
        this.stop(windowId);
        this.#runs.log(windowId, t('bisectInvalid'), 'error');
      });
      return;
    }

    const bisector = new Bisector(range);
    const session: Session = { auto: false, bisector, stopped: false };
    this.#sessions.set(windowId, session);
    this.#setBisect(windowId, { good, bad, auto: false, current: null, result: null });
    await this.#show(windowId, session, bisector.current());
  }

  async mark(windowId: string, verdict: 'good' | 'bad' | 'skip'): Promise<void> {
    const session = this.#sessions.get(windowId);
    const bisector = session?.bisector;
    if (!session || !bisector || session.stepping) return;
    const step =
      verdict === 'good'
        ? bisector.good()
        : verdict === 'bad'
          ? bisector.bad()
          : bisector.skip();
    await this.#show(windowId, session, step);
  }

  stop(windowId: string): void {
    const session = this.#sessions.get(windowId);
    if (session) {
      session.stopped = true;
      if (session.auto) this.#runs.stop(windowId);
    }
    this.#sessions.delete(windowId);
    if (this.#runs.state(windowId).bisect)
      this.#runs.setState(windowId, { bisect: null });
  }

  compareUrl(windowId: string): string | undefined {
    const result = this.#runs.state(windowId).bisect?.result;
    return result ? bisectCompareUrl(result.good, result.bad) : undefined;
  }

  async #show(windowId: string, session: Session, step: BisectStep): Promise<void> {
    const t = tm('mainRun');
    const current = this.#runs.state(windowId).bisect;
    if (!current) return;
    if (step.done) {
      this.#finish(windowId, session, step.good, step.bad);
      return;
    }
    this.#runs.stop(windowId);
    session.stepping = true;
    try {
      await documents.setFiddleVersion(windowId, {
        kind: 'release',
        version: step.version,
      });
    } finally {
      session.stepping = false;
    }
    if (this.#sessions.get(windowId) !== session) return;
    this.#typesChanged(windowId);
    this.#setBisect(windowId, { ...current, current: step.version });
    this.#runs.log(windowId, t('bisectStep', { version: step.version }));
    if (!this.#versions.isInstalled(step.version)) {
      void this.#versions
        .install(step.version)
        .catch((error: unknown) => log.warn('bisect download failed', error));
    }
  }

  async #auto(windowId: string, session: Session, range: string[]): Promise<void> {
    const t = tm('mainRun');
    const check = async (version: string): Promise<boolean | undefined> => {
      if (session.stopped) return undefined;
      const current = this.#runs.state(windowId).bisect;
      if (current) this.#setBisect(windowId, { ...current, current: version });
      // Each step checks trust again, so a fiddle loaded mid-bisect never runs unapproved.
      const outcome = await this.#runs.run(windowId, {
        versionRef: { kind: 'release', version },
        trustOperation: 'auto-bisect',
        banner: t('bisectStep', { version }),
      });
      if (session.stopped) return undefined;
      const good = bisectVerdict(outcome);
      if (good === undefined) {
        // A stop from the Run control ends the bisect quietly, as its own Stop does.
        if (!outcome.stopped) this.#runs.log(windowId, t('bisectInvalid'), 'error');
        return undefined;
      }
      this.#runs.log(
        windowId,
        good ? t('bisectVerdictGood', { version }) : t('bisectVerdictBad', { version }),
      );
      return good;
    };

    const result = await autoBisect(range, check);
    if ('stopped' in result) return this.#abort(windowId, session, result.unexpected);
    this.#finish(windowId, session, result.good, result.bad);
  }

  /** Ends `session` without a result. A session that was stopped and replaced leaves the new one alone. */
  #abort(windowId: string, session: Session, unexpected: string | undefined): void {
    if (this.#sessions.get(windowId) !== session) return;
    if (unexpected)
      this.#runs.log(
        windowId,
        tm('mainRun')('bisectVerifyFailed', { version: unexpected }),
        'error',
      );
    this.#sessions.delete(windowId);
    if (this.#runs.state(windowId).bisect)
      this.#runs.setState(windowId, { bisect: null });
  }

  #finish(windowId: string, session: Session, good: string, bad: string): void {
    if (this.#sessions.get(windowId) !== session) return;
    const current = this.#runs.state(windowId).bisect;
    this.#sessions.delete(windowId);
    if (!current) return;
    this.#setBisect(windowId, { ...current, current: null, result: { good, bad } });
    this.#runs.log(
      windowId,
      tm('mainRun')('bisectDone', { good, bad, url: bisectCompareUrl(good, bad) }),
    );
  }

  #setBisect(windowId: string, bisect: BisectState): void {
    this.#runs.setState(windowId, { bisect });
  }
}
