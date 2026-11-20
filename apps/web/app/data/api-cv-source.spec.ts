import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiCvSource, DEFAULT_TIMEOUT_MS } from './api-cv-source.js';
import { CvSourceError, type FetchFn } from './cv-source.js';
import { cvEn } from './fixtures/cv.en.js';
import { cvFr } from './fixtures/cv.fr.js';

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });

/** Doublure de `fetch` qui répond `response` et garde les appels. */
function fetchReturning(response: Response | (() => Response)) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn: FetchFn = (input, init) => {
    calls.push({ url: input as string, init });
    return Promise.resolve(typeof response === 'function' ? response() : response);
  };
  return { fetchFn, calls };
}

/** Capture l'erreur d'une promesse rejetée. */
async function rejection(promise: Promise<unknown>): Promise<CvSourceError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CvSourceError) return error;
    throw error;
  }
  throw new Error('la promesse aurait dû être rejetée');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiCvSource : lecture', () => {
  it('demande GET {baseUrl}/api/v1/cv?lang=fr et rend le CV validé', async () => {
    const { fetchFn, calls } = fetchReturning(jsonResponse(cvFr));
    const source = new ApiCvSource({ baseUrl: 'http://localhost:3000', fetch: fetchFn });

    const cv = await source.load('fr');

    expect(cv).toEqual(cvFr);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://localhost:3000/api/v1/cv?lang=fr');
    expect(calls[0]?.init?.headers).toEqual({ Accept: 'application/json' });
  });

  it('demande la langue en', async () => {
    const { fetchFn, calls } = fetchReturning(jsonResponse(cvEn));
    const source = new ApiCvSource({ baseUrl: 'https://api.example.org', fetch: fetchFn });

    expect((await source.load('en')).locale).toBe('en');
    expect(calls[0]?.url).toBe('https://api.example.org/api/v1/cv?lang=en');
  });

  it('retire les espaces et les barres finales de l’URL de base, garde un préfixe de chemin', async () => {
    const { fetchFn, calls } = fetchReturning(() => jsonResponse(cvFr));

    await new ApiCvSource({ baseUrl: '  http://localhost:3000///  ', fetch: fetchFn }).load('fr');
    await new ApiCvSource({ baseUrl: 'https://example.org/prefix/', fetch: fetchFn }).load('fr');

    expect(calls.map((call) => call.url)).toEqual([
      'http://localhost:3000/api/v1/cv?lang=fr',
      'https://example.org/prefix/api/v1/cv?lang=fr',
    ]);
  });

  it('borne la lecture par un délai (10 s par défaut)', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { fetchFn, calls } = fetchReturning(jsonResponse(cvFr));

    await new ApiCvSource({ baseUrl: 'http://localhost:3000', fetch: fetchFn }).load('fr');

    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000);
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('applique le délai demandé', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { fetchFn } = fetchReturning(jsonResponse(cvFr));

    await new ApiCvSource({
      baseUrl: 'http://localhost:3000',
      fetch: fetchFn,
      timeoutMs: 1234,
    }).load('fr');

    expect(timeout).toHaveBeenCalledExactlyOnceWith(1234);
  });
});

describe('ApiCvSource : URL de base', () => {
  it.each(['', '   ', 'localhost:3000', 'pas une url', 'ftp://example.org', 'file:///tmp/cv'])(
    'refuse « %s » (adresse http ou https attendue)',
    (baseUrl) => {
      const { fetchFn } = fetchReturning(jsonResponse(cvFr));

      let caught: unknown;
      try {
        new ApiCvSource({ baseUrl, fetch: fetchFn });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(CvSourceError);
      expect((caught as CvSourceError).kind).toBe('config');
      expect((caught as CvSourceError).message).toBe(
        `URL de base de l'API invalide : « ${baseUrl} » (adresse http ou https attendue)`,
      );
    },
  );
});

describe('ApiCvSource : échecs explicites', () => {
  const baseUrl = 'http://localhost:3000';
  const origin = 'GET http://localhost:3000/api/v1/cv?lang=fr';

  it('réseau : API injoignable, avec la cause (fetch de Node ne dit que « fetch failed »)', async () => {
    const cause = new Error('connect ECONNREFUSED 127.0.0.1:3000');
    const failing: FetchFn = () => Promise.reject(new TypeError('fetch failed', { cause }));

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: failing }).load('fr'));

    expect(error.kind).toBe('network');
    expect(error.message).toBe(
      `API injoignable (${origin}) : fetch failed (connect ECONNREFUSED 127.0.0.1:3000)`,
    );
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it('réseau : une erreur sans cause garde son seul message', async () => {
    const failing: FetchFn = () => Promise.reject(new Error('getaddrinfo ENOTFOUND'));

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: failing }).load('fr'));

    expect(error.message).toBe(`API injoignable (${origin}) : getaddrinfo ENOTFOUND`);
  });

  it('réseau : une valeur qui n’est pas une erreur est citée telle quelle', async () => {
    const reason: unknown = 'coupure';
    const failing: FetchFn = () => {
      throw reason;
    };

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: failing }).load('fr'));

    expect(error.kind).toBe('network');
    expect(error.message).toBe(`API injoignable (${origin}) : coupure`);
  });

  it('réseau : une cause qui n’est pas une erreur est ignorée', async () => {
    const failing: FetchFn = () =>
      Promise.reject(new TypeError('fetch failed', { cause: 'texte' }));

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: failing }).load('fr'));

    expect(error.message).toBe(`API injoignable (${origin}) : fetch failed`);
  });

  it('réseau : un délai dépassé fait échouer la lecture', async () => {
    const hanging: FetchFn = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason instanceof Error ? init.signal.reason : new Error('abandon')),
        );
      });

    const error = await rejection(
      new ApiCvSource({ baseUrl, fetch: hanging, timeoutMs: 20 }).load('fr'),
    );

    expect(error.kind).toBe('network');
    expect(error.message).toMatch(/^API injoignable \(GET .*\) : .*timeout/i);
  });

  it('HTTP : statut hors 2xx avec le detail du problem+json', async () => {
    const problem = {
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Base de données indisponible.',
    };
    const { fetchFn } = fetchReturning(
      jsonResponse(problem, {
        status: 503,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: fetchFn }).load('fr'));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(503);
    expect(error.message).toBe(
      `L'API a répondu HTTP 503 (${origin}) : Base de données indisponible.`,
    );
  });

  it('HTTP : le detail seul suffit, même sans les autres champs du problème', async () => {
    const { fetchFn } = fetchReturning(
      jsonResponse({ detail: 'Trop de requêtes' }, { status: 429 }),
    );

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: fetchFn }).load('fr'));

    expect(error.message).toBe(`L'API a répondu HTTP 429 (${origin}) : Trop de requêtes`);
  });

  it('HTTP : sans detail, le statut seul', async () => {
    const { fetchFn } = fetchReturning(
      jsonResponse({ type: 'about:blank', title: 'Not Found', status: 404 }, { status: 404 }),
    );

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: fetchFn }).load('fr'));

    expect(error.status).toBe(404);
    expect(error.message).toBe(`L'API a répondu HTTP 404 (${origin})`);
  });

  it('HTTP : un corps qui n’est pas du JSON est signalé sans masquer le statut', async () => {
    const { fetchFn } = fetchReturning(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: fetchFn }).load('fr'));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(502);
    expect(error.message).toBe(`L'API a répondu HTTP 502 (${origin}) : corps de réponse non JSON`);
  });

  it('HTTP : un JSON d’une autre forme ne masque pas le statut', async () => {
    for (const body of ['texte', { detail: 42 }, null, ['detail']]) {
      const { fetchFn } = fetchReturning(jsonResponse(body, { status: 502 }));

      const error = await rejection(new ApiCvSource({ baseUrl, fetch: fetchFn }).load('fr'));

      expect(error.status).toBe(502);
      expect(error.message).toBe(`L'API a répondu HTTP 502 (${origin})`);
    }
  });

  it('réponse : un corps qui n’est pas du JSON', async () => {
    const { fetchFn } = fetchReturning(new Response('<html></html>', { status: 200 }));

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: fetchFn }).load('fr'));

    expect(error.kind).toBe('invalid');
    expect(error.message).toMatch(
      new RegExp(`^Réponse non JSON \\(${origin.replace('?', '\\?')}\\) : .+`),
    );
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('réponse : hors contrat, avec le chemin du champ fautif', async () => {
    const broken = structuredClone(cvFr);
    broken.experiences = broken.experiences.map((experience, index) =>
      index === 0 ? { ...experience, kind: 'inconnu' as never } : experience,
    );
    const { fetchFn } = fetchReturning(jsonResponse(broken));

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: fetchFn }).load('fr'));

    expect(error.kind).toBe('invalid');
    expect(error.message).toContain(
      `Réponse non conforme au contrat Cv (${origin}) : experiences.0.kind : `,
    );
  });

  it('réponse : une autre langue que celle demandée', async () => {
    const { fetchFn } = fetchReturning(jsonResponse(cvEn));

    const error = await rejection(new ApiCvSource({ baseUrl, fetch: fetchFn }).load('fr'));

    expect(error.kind).toBe('invalid');
    expect(error.message).toBe(`Langue inattendue (${origin}) : « fr » demandée, « en » reçue`);
  });
});
