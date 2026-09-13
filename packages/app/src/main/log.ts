/**
 * Minimal main-process logger. JSON-lines logs in <userData>/logs, with
 * rotation and redaction, arrive with the logging milestone (§14); keep call
 * sites to `log.info|warn|error(message, ...details)` so that swap is local.
 */
const PREFIX = '[fiddle]';

export const log = {
  info: (message: string, ...details: unknown[]) =>
    console.log(PREFIX, message, ...details),
  warn: (message: string, ...details: unknown[]) =>
    console.warn(PREFIX, message, ...details),
  error: (message: string, ...details: unknown[]) =>
    console.error(PREFIX, message, ...details),
};
