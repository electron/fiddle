/**
 * The onboarding tour: offered on first launch until it's finished or
 * dismissed, and replayed by `help.showTour`. Coachmarks use Popover styling
 * and cut a highlighted hole around the element they explain.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';

import { documentsApi, onboardingApi, windowApi } from '../../../ipc/renderer';
import { Button } from '../../../ui';
import styles from './OnboardingTour.module.css';
import {
  BASICS_STEPS,
  CARD_WIDTH,
  MAIN_STEPS,
  placeCard,
  type Rect,
  type TourTarget,
} from './steps';

type Mode = 'off' | 'offer' | 'main' | 'basics';

function findTarget(target: TourTarget | undefined): Rect | null {
  if (!target) return null;
  const element = document.querySelector(`[data-tour="${target}"]`);
  if (!element) return null;
  const { top, left, width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0 ? { top, left, width, height } : null;
}

/** The target's rectangle, kept current on resize. */
function useTargetRect(target: TourTarget | undefined, key: unknown): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    const update = () => setRect(findTarget(target));
    // The target may appear a frame later (a file switch, a layout change).
    const frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
    };
  }, [target, key]);
  return rect;
}

/** Positions a card of CARD_WIDTH once its height is known. */
function useCardPosition(
  place: (height: number) => { top: number; left: number },
  deps: unknown[],
) {
  const card = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() =>
      setPosition(place(card.current?.offsetHeight ?? 160)),
    );
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const style = {
    width: CARD_WIDTH,
    top: position?.top ?? -9999,
    left: position?.left ?? -9999,
  };
  return { card, style };
}

interface StepCardProps {
  rect: Rect | null;
  label: string;
  onEscape(): void;
  onArrow(key: 'ArrowLeft' | 'ArrowRight'): void;
  children: ReactNode;
}

/** A modal tour step: dims the window, rings the target and contains focus. */
function StepCard({ rect, label, onEscape, onArrow, children }: StepCardProps) {
  const { card, style } = useCardPosition(
    (height) =>
      placeCard(
        rect,
        { width: CARD_WIDTH, height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    [rect, children],
  );
  return (
    <ModalOverlay
      isOpen
      isDismissable={false}
      onOpenChange={(open) => !open && onEscape()}
      className={styles.layer}
    >
      {rect ? (
        <div
          className={styles.hole}
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ) : (
        <div className={styles.dim} />
      )}
      <Modal ref={card} className={styles.card} style={style}>
        <Dialog aria-label={label}>
          {/* Arrow keys step through the tour; Escape (the overlay) ends it. */}
          <div
            className={styles.dialog}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
                onArrow(event.key);
            }}
          >
            {children}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The first-launch offer: non-modal, in the bottom corner, doesn't take focus. */
function OfferCard({ label, children }: { label: string; children: ReactNode }) {
  const { card, style } = useCardPosition(
    (height) => ({
      top: window.innerHeight - height - 48,
      left: window.innerWidth - CARD_WIDTH - 24,
    }),
    [],
  );
  return (
    <div
      ref={card}
      role="dialog"
      aria-label={label}
      className={styles.card}
      style={style}
    >
      <div className={styles.dialog}>{children}</div>
    </div>
  );
}

export function OnboardingTour() {
  const { t } = useTranslation('onboarding');
  const [mode, setMode] = useState<Mode>('off');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let live = true;
    onboardingApi.ShouldOfferTour().then(
      (offer) =>
        live && offer && setMode((current) => (current === 'off' ? 'offer' : current)),
      () => {},
    );
    const stop = windowApi.onCommand((id) => {
      if (id !== 'help.showTour') return;
      setIndex(0);
      setMode('main');
    });
    return () => {
      live = false;
      stop();
    };
  }, []);

  const steps = mode === 'basics' ? BASICS_STEPS : MAIN_STEPS;
  const step = mode === 'main' || mode === 'basics' ? steps[index] : undefined;
  const isLast = index === steps.length - 1;
  const offersBasics = mode === 'main' && isLast;

  useEffect(() => {
    if (step?.file) documentsApi.SetActiveFile(step.file).catch(() => {});
  }, [step]);

  const rect = useTargetRect(step?.target, step);

  const finish = useCallback(() => {
    setMode('off');
    onboardingApi.SetTourDone().catch(() => {});
  }, []);
  const start = (next: Mode) => {
    setIndex(0);
    setMode(next);
  };
  const next = () => {
    if (isLast) finish();
    else setIndex(index + 1);
  };
  const back = () => setIndex(Math.max(0, index - 1));

  if (mode === 'offer') {
    return (
      <OfferCard label={t('offerTitle')}>
        <div className={styles.title}>{t('offerTitle')}</div>
        <div className={styles.body}>{t('offerBody')}</div>
        <div className={styles.foot}>
          <span className={styles.spacer} />
          <Button size="sm" variant="ghost" onPress={finish}>
            {t('notNow')}
          </Button>
          <Button size="sm" variant="primary" onPress={() => start('main')}>
            {t('start')}
          </Button>
        </div>
      </OfferCard>
    );
  }

  if (!step) return null;
  return (
    <StepCard
      rect={rect}
      label={t('label')}
      onEscape={finish}
      onArrow={(key) => {
        if (key === 'ArrowRight' && !offersBasics) next();
        if (key === 'ArrowLeft') back();
      }}
    >
      <div className={styles.step}>
        {t('stepCount', { current: index + 1, total: steps.length })}
      </div>
      <div className={styles.title}>{t(step.title)}</div>
      <div className={styles.body}>{t(step.body)}</div>
      <div className={styles.foot}>
        {!isLast && (
          <Button size="sm" variant="ghost" onPress={finish}>
            {t('skipTour')}
          </Button>
        )}
        <span className={styles.spacer} />
        {index > 0 && (
          <Button size="sm" variant="secondary" onPress={back}>
            {t('back')}
          </Button>
        )}
        {offersBasics ? (
          <>
            <Button size="sm" variant="secondary" onPress={finish}>
              {t('done')}
            </Button>
            <Button size="sm" variant="primary" onPress={() => start('basics')}>
              {t('basicsStart')}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="primary" onPress={next} autoFocus>
            {isLast ? t('done') : t('next')}
          </Button>
        )}
      </div>
    </StepCard>
  );
}
