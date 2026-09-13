/**
 * Turns off zod's JIT before any other renderer module runs. The CSP enforces
 * Trusted Types, and zod's `new Function` probe is reported as a violation.
 * `shared/stores.ts` sets the same flag, but modules it imports (settings
 * defaults) parse schemas while they load, before its body runs. Import this
 * first in main.tsx.
 */
import { z } from 'zod';

z.config({ jitless: true });
