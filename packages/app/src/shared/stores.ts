/**
 * The two EIPC stores. Main owns them and is their only writer (through the
 * StateHub); renderers read them and request changes through methods.
 *
 * These zod schemas are the single source of truth: the EIPC schema imports
 * them with `zod_reference`, so every pushed value is validated, and the
 * TypeScript types below are inferred from them.
 *
 * Keep stores small. Bulk data (fiddle text, release lists, console output) is
 * fetched with a method; a store only carries a revision number for it.
 */
import { z } from 'zod';

export const platformSchema = z.enum(['darwin', 'win32', 'linux']);
export type Platform = z.infer<typeof platformSchema>;

/**
 * The OS material under the window chrome (Lucent "Glass on real windows").
 * `none` means the renderer adds `lu-no-material` to `<html>`.
 */
export const materialSchema = z.enum(['vibrancy', 'acrylic', 'none']);
export type Material = z.infer<typeof materialSchema>;

/** Shared state: the same value in every window. */
export const appStateSchema = z.object({
  /** Increases by one with every change main applies. */
  rev: z.number().int().nonnegative(),
  /** Active UI locale, e.g. `en`. */
  locale: z.string(),
  platform: platformSchema,
  material: materialSchema,
});
export type AppState = z.infer<typeof appStateSchema>;

/** Per-window state. Each window only ever sees its own. */
export const windowStateSchema = z.object({
  /** Increases by one with every change main applies. */
  rev: z.number().int().nonnegative(),
  /** UUID assigned by main. Renderers never send it; handlers close over it. */
  windowId: z.uuid(),
  title: z.string(),
});
export type WindowState = z.infer<typeof windowStateSchema>;
