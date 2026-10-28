/** Tests the first-run tour: the offer, stepping through, the Electron basics, and what it reports to main. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BASICS_STEPS, MAIN_STEPS } from './steps';

const mocks = vi.hoisted(() => ({
  offer: true,
  activeFile: 'a.js' as string | null,
  commands: [] as Array<(id: string) => void>,
  appPlatformApi: {
    ShouldOfferTour: vi.fn(() => Promise.resolve(mocks.offer)),
    SetTourDone: vi.fn(() => Promise.resolve()),
  },
  documentsApi: { SetActiveFile: vi.fn((_file: string) => Promise.resolve(1)) },
}));

vi.mock('../../../ipc/renderer', () => ({
  appPlatformApi: mocks.appPlatformApi,
  documentsApi: mocks.documentsApi,
  windowApi: {
    onCommand: (listener: (id: string) => void) => {
      mocks.commands.push(listener);
      return () => undefined;
    },
  },
}));
vi.mock('../../state', () => ({
  useWindowState: () => ({ fiddle: { activeFile: mocks.activeFile } }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { current?: number; total?: number }) =>
      options?.total ? `${key} ${options.current}/${options.total}` : key,
  }),
}));

import { OnboardingTour } from './OnboardingTour';

const forward = (id: string) =>
  act(() => mocks.commands.forEach((listener) => listener(id)));
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const tour = () => screen.getByRole('dialog', { name: 'label' });
const stepCount = () => screen.getByText(/^stepCount /).textContent;

/** Renders the tour and takes the first-launch offer. */
async function startTour(): Promise<void> {
  render(<OnboardingTour />);
  await screen.findByRole('dialog', { name: 'offerTitle' });
  press('start');
  await screen.findByRole('dialog', { name: 'label' });
}

const goToLastMainStep = () => {
  for (let i = 1; i < MAIN_STEPS.length; i++) press('next');
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.offer = true;
  mocks.activeFile = 'a.js';
  mocks.commands.length = 0;
  // jsdom has no layout: the card measures itself with a ResizeObserver.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('OnboardingTour', () => {
  it('stays out of the way when main says not to offer the tour', async () => {
    mocks.offer = false;
    render(<OnboardingTour />);
    await act(async () => undefined);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers the tour on first launch, and reports it done on Not now', async () => {
    render(<OnboardingTour />);
    await screen.findByRole('dialog', { name: 'offerTitle' });
    press('notNow');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.appPlatformApi.SetTourDone).toHaveBeenCalledTimes(1);
    expect(mocks.documentsApi.SetActiveFile).not.toHaveBeenCalled();
  });

  it('steps forward and back through the main tour', async () => {
    await startTour();
    expect(stepCount()).toBe(`stepCount 1/${MAIN_STEPS.length}`);
    expect(screen.getByText(MAIN_STEPS[0]!.title)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'back' })).toBeNull();

    press('next');
    expect(stepCount()).toBe(`stepCount 2/${MAIN_STEPS.length}`);
    expect(screen.getByText(MAIN_STEPS[1]!.title)).toBeTruthy();

    press('back');
    expect(stepCount()).toBe(`stepCount 1/${MAIN_STEPS.length}`);
    expect(mocks.appPlatformApi.SetTourDone).not.toHaveBeenCalled();
  });

  it('reports the tour done when it is skipped part-way', async () => {
    await startTour();
    press('next');
    press('skipTour');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.appPlatformApi.SetTourDone).toHaveBeenCalledTimes(1);
  });

  it('ends on a step that offers the Electron basics, where Done finishes without them', async () => {
    await startTour();
    goToLastMainStep();
    expect(stepCount()).toBe(`stepCount ${MAIN_STEPS.length}/${MAIN_STEPS.length}`);
    expect(screen.queryByRole('button', { name: 'skipTour' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'next' })).toBeNull();

    press('done');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.appPlatformApi.SetTourDone).toHaveBeenCalledTimes(1);
    expect(mocks.documentsApi.SetActiveFile).not.toHaveBeenCalled();
  });

  it('opens each basics file in turn, then returns to the file that was open', async () => {
    await startTour();
    goToLastMainStep();
    press('basicsStart');

    for (const [i, step] of BASICS_STEPS.entries()) {
      expect(stepCount()).toBe(`stepCount ${i + 1}/${BASICS_STEPS.length}`);
      expect(screen.getByText(step.title)).toBeTruthy();
      expect(mocks.documentsApi.SetActiveFile).toHaveBeenLastCalledWith(step.file);
      press(i === BASICS_STEPS.length - 1 ? 'done' : 'next');
    }

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.appPlatformApi.SetTourDone).toHaveBeenCalledTimes(1);
    expect(mocks.documentsApi.SetActiveFile).toHaveBeenLastCalledWith('a.js');
  });

  it('steps with the arrow keys and ends on Escape', async () => {
    await startTour();
    const keys = () => screen.getByText(/^stepCount /).parentElement!;
    fireEvent.keyDown(keys(), { key: 'ArrowRight' });
    fireEvent.keyDown(keys(), { key: 'ArrowRight' });
    expect(stepCount()).toBe(`stepCount 3/${MAIN_STEPS.length}`);
    fireEvent.keyDown(keys(), { key: 'ArrowLeft' });
    expect(stepCount()).toBe(`stepCount 2/${MAIN_STEPS.length}`);

    // On the last step the right arrow doesn't finish: the basics are on offer there.
    for (let i = 2; i <= MAIN_STEPS.length; i++)
      fireEvent.keyDown(keys(), { key: 'ArrowRight' });
    expect(stepCount()).toBe(`stepCount ${MAIN_STEPS.length}/${MAIN_STEPS.length}`);
    expect(mocks.appPlatformApi.SetTourDone).not.toHaveBeenCalled();

    fireEvent.keyDown(keys(), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.appPlatformApi.SetTourDone).toHaveBeenCalledTimes(1);
  });

  it('starts again from the first step on Help > Show tour, and ignores other commands', async () => {
    mocks.offer = false;
    render(<OnboardingTour />);
    await act(async () => undefined);
    forward('file.save');
    expect(screen.queryByRole('dialog')).toBeNull();

    forward('help.showTour');
    expect(tour()).toBeTruthy();
    expect(stepCount()).toBe(`stepCount 1/${MAIN_STEPS.length}`);
  });

  it('rings the step target with a halo once it has been laid out', async () => {
    const target = document.createElement('div');
    target.dataset.tour = MAIN_STEPS[0]!.target;
    target.getBoundingClientRect = () =>
      ({ top: 100, left: 50, width: 40, height: 20 }) as DOMRect;
    document.body.append(target);
    try {
      await startTour();
      // The target is measured a frame later; the ring sits 4px outside it.
      await waitFor(() =>
        expect(document.querySelector<HTMLElement>('[style*="top: 96px"]')).toBeTruthy(),
      );
      const ring = document.querySelector<HTMLElement>('[style*="top: 96px"]')!;
      expect(ring.style.left).toBe('46px');
      expect(ring.style.width).toBe('48px');
      expect(ring.style.height).toBe('28px');
    } finally {
      target.remove();
    }
  });
});
