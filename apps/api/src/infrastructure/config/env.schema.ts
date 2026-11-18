import { z } from 'zod';

/** Adresse IP, plage CIDR (IPv4 ou IPv6) ou plage nommée de proxy-addr. */
const ProxyAddressSchema = z.union([
  z.ipv4(),
  z.ipv6(),
  z.cidrv4(),
  z.cidrv6(),
  z.enum(['loopback', 'linklocal', 'uniquelocal']),
]);

/** Valeur de `trustProxy` de Fastify : `false` ou une liste d'IP, de CIDR ou de plages nommées. */
export type TrustProxy = false | string[];

const TrustProxySchema = z
  .string()
  .trim()
  .transform((value, ctx): TrustProxy => {
    if (value === '' || value === 'false') {
      return false;
    }
    const addresses = value.split(',').map((address) => address.trim());
    if (addresses.every((address) => ProxyAddressSchema.safeParse(address).success)) {
      return addresses;
    }
    ctx.addIssue({
      code: 'custom',
      message:
        'attendu : false ou une liste d’IP, de CIDR ou de plages nommées (loopback, linklocal, uniquelocal) ' +
        'séparés par des virgules ; « true » est refusé (il ferait confiance à tous les sauts) ' +
        'et Fastify 5 refuse un simple nombre de sauts',
    });
    return z.NEVER;
  });

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
   * Proxys de confiance pour lire l'IP du client dans `X-Forwarded-For` (sinon le rate limiting
   * verrait l'IP du proxy). `false` (défaut) : aucun. Sinon une liste d'IP, de CIDR ou de plages
   * nommées (`uniquelocal` = réseaux privés, pour Caddy sur le réseau Docker interne) séparés par
   * des virgules : seuls ces pairs sont des proxys et seul leur `X-Forwarded-For` est cru. Jamais
   * « tous les sauts » (`true`) : un client qui atteint l'API sans passer par le proxy falsifierait
   * l'en-tête et contournerait le quota.
   */
  TRUST_PROXY: z.string().default('false').pipe(TrustProxySchema),
});

export type Env = z.infer<typeof EnvSchema>;
