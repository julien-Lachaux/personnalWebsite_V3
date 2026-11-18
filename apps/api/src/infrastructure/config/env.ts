import { z } from 'zod';

import { type Env, EnvSchema } from './env.schema.js';

/** Lit et valide la configuration depuis `process.env` (ou toute autre source clé/valeur). */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuration d'environnement invalide :\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
