// Port de lecture du CV (docs/04) : une seule lecture par langue, `GET /api/v1/cv?lang=fr|en`.
// Le front dépend de ce port, jamais d'une implémentation : l'API au build, ou des fixtures validées
// par le même contrat. TypeScript pur, sans Vue ni Nuxt (testé dans le projet Vitest `unit`).
import { type Cv, type Locale } from '@siteperso/contracts';

/** Lit le CV dans une langue. Rejette avec une `CvSourceError` explicite si la lecture échoue. */
export interface CvSource {
  load(locale: Locale): Promise<Cv>;
}

/** `fetch` injecté (celui de Node au build, une doublure dans les tests). */
export type FetchFn = typeof globalThis.fetch;

/**
 * Nature de l'échec de lecture :
 * - `config` : source ou URL de base de l'API absente ou invalide ;
 * - `network` : l'API ne répond pas (réseau, DNS, délai dépassé) ;
 * - `http` : l'API répond un statut hors 2xx ;
 * - `invalid` : la réponse n'est pas du JSON, ou ne respecte pas le contrat `Cv`.
 */
export type CvSourceErrorKind = 'config' | 'network' | 'http' | 'invalid';

/** Échec de lecture du CV : au build (génération statique) il fait échouer la génération. */
export class CvSourceError extends Error {
  readonly kind: CvSourceErrorKind;
  /** Statut HTTP de la réponse (kind `http` seulement). */
  readonly status: number | undefined;

  constructor(
    kind: CvSourceErrorKind,
    message: string,
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'CvSourceError';
    this.kind = kind;
    this.status = options.status;
  }
}
