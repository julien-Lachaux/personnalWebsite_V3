// Source de l'API : `GET {baseUrl}/api/v1/cv?lang=fr|en` (docs/04), lue au build (génération
// statique). Chaque échec est explicite : réseau, statut HTTP (avec le `detail` du problem+json),
// réponse hors contrat (avec le chemin du champ fautif). Un échec ne se masque jamais : au build,
// une API qui ne répond pas fait échouer la génération plutôt que d'embarquer un site vide.
import { ProblemDetailsSchema, type Cv, type Locale } from '@siteperso/contracts';

import { CvSourceError, type CvSource, type FetchFn } from './cv-source.js';
import { parseCv } from './parse-cv.js';

/** Délai maximal d'une lecture (ms) : une API qui ne répond pas ne doit pas suspendre le build. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Protocoles admis pour l'URL de base de l'API. */
const HTTP_PROTOCOLS: readonly string[] = ['http:', 'https:'];

/** Complément du message quand le corps d'une réponse d'erreur n'est pas du JSON (proxy, page HTML). */
const NOT_JSON = 'corps de réponse non JSON';

/** Seul le `detail` d'un problem+json (RFC 9457) sert au message. */
const ProblemDetailSchema = ProblemDetailsSchema.pick({ detail: true });

export interface ApiCvSourceOptions {
  /** URL de base de l'API, sans `/api/v1` (ex. `http://localhost:3000`). `http` ou `https`. */
  readonly baseUrl: string;
  readonly fetch: FetchFn;
  /** Délai maximal d'une lecture en ms (défaut `DEFAULT_TIMEOUT_MS`). */
  readonly timeoutMs?: number;
}

export class ApiCvSource implements CvSource {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;
  private readonly timeoutMs: number;

  constructor(options: ApiCvSourceOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchFn = options.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async load(locale: Locale): Promise<Cv> {
    const url = `${this.baseUrl}/api/v1/cv?lang=${locale}`;
    const origin = `GET ${url}`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new CvSourceError('network', `API injoignable (${origin}) : ${describe(error)}`, {
        cause: error,
      });
    }

    if (!response.ok) {
      const detail = await problemDetail(response);
      throw new CvSourceError(
        'http',
        `L'API a répondu HTTP ${response.status} (${origin})${detail === undefined ? '' : ` : ${detail}`}`,
        { status: response.status },
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new CvSourceError('invalid', `Réponse non JSON (${origin}) : ${describe(error)}`, {
        cause: error,
      });
    }
    return parseCv(body, locale, origin);
  }
}

/** URL de base validée (`http` ou `https`), sans barre finale : le chemin de l'API s'y ajoute. */
function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!URL.canParse(trimmed) || !HTTP_PROTOCOLS.includes(new URL(trimmed).protocol)) {
    throw new CvSourceError(
      'config',
      `URL de base de l'API invalide : « ${baseUrl} » (adresse http ou https attendue)`,
    );
  }
  return trimmed.replace(/\/+$/, '');
}

/** Complément du message d'un statut hors 2xx : le `detail` du problem+json, s'il y en a un. */
async function problemDetail(response: Response): Promise<string | undefined> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return NOT_JSON;
  }
  const parsed = ProblemDetailSchema.safeParse(body);
  return parsed.success ? parsed.data.detail : undefined;
}

/** Message d'une erreur, avec celui de sa cause : `fetch` de Node ne dit que « fetch failed » seul. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message;
}
