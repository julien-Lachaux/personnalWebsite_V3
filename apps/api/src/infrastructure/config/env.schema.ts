import { z } from 'zod';

/**
 * Variables d'environnement de l'API, validées au démarrage.
 * Toute variable absente ou invalide empêche le démarrage avec un message explicite.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Origine(s) autorisée(s) par CORS, séparées par des virgules. */
  CORS_ORIGIN: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    )
    .pipe(z.array(z.url()).min(1)),
});

export type Env = z.infer<typeof EnvSchema>;
