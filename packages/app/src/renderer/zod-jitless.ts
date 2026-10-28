// The CSP enforces Trusted Types, and zod's `new Function` probe is reported as a violation. Import this first.
import { z } from 'zod';

z.config({ jitless: true });
