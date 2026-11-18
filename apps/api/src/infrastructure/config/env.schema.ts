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
  /**
   * Rate limiting global (docs/02 « sécurité dès le départ ») : nombre maximal de requêtes
   * par adresse IP sur une fenêtre glissante de RATE_LIMIT_WINDOW_MS millisecondes.
   */
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  /**
   * Derrière un reverse proxy (Caddy en prod), l'IP du client est lue dans `X-Forwarded-For`
   * uniquement si cette option est à `true` ; sinon le rate limiting verrait l'IP du proxy.
   */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;
