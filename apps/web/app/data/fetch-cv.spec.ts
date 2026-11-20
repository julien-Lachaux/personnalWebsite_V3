import { type Cv } from '@siteperso/contracts';
import { describe, expect, it, vi } from 'vitest';

import { CvSourceError, type FetchFn } from './cv-source.js';
import { cvAsyncDataKey, fetchCv, type AsyncDataResult, type FetchCvDeps } from './fetch-cv.js';
import { cvEn } from './fixtures/cv.en.js';
import { cvFr } from './fixtures/cv.fr.js';

const neverCalled: FetchFn = () => Promise.reject(new Error('aucun appel réseau attendu'));

/**
 * Doublure de `useAsyncData` : exécute le gestionnaire et range le résultat ou l'erreur dans le
 * retour, comme Nuxt (l'erreur n'est pas levée).
 */
function asyncDataRunning(keys: string[] = []): FetchCvDeps['asyncData'] {
  return async (key, handler) => {
    keys.push(key);
    try {
      return { data: { value: await handler() }, error: { value: undefined } };
    } catch (error) {
      return { data: { value: undefined }, error: { value: error } };
    }
  };
}

const fixtures = { source: 'fixtures', apiBaseUrl: undefined };

describe('cvAsyncDataKey', () => {
  it('donne une clé par langue', () => {
    expect(cvAsyncDataKey('fr')).toBe('cv-fr');
    expect(cvAsyncDataKey('en')).toBe('cv-en');
  });
});

describe('fetchCv', () => {
  it('lit le CV de la langue sous sa clé de charge utile', async () => {
    const keys: string[] = [];
    const deps: FetchCvDeps = {
      asyncData: asyncDataRunning(keys),
      settings: () => fixtures,
      fetch: neverCalled,
    };

    expect(await fetchCv(deps, 'fr')).toEqual(cvFr);
    expect(await fetchCv(deps, 'en')).toEqual(cvEn);
    expect(keys).toEqual(['cv-fr', 'cv-en']);
  });

  it('lit l’API avec le fetch injecté quand la configuration le demande', async () => {
    const urls: string[] = [];
    const fetchFn: FetchFn = (input) => {
      urls.push(input as string);
      return Promise.resolve(new Response(JSON.stringify(cvEn)));
    };
    const deps: FetchCvDeps = {
      asyncData: asyncDataRunning(),
      settings: () => ({ source: 'api', apiBaseUrl: 'http://localhost:3000' }),
      fetch: fetchFn,
    };

    expect(await fetchCv(deps, 'en')).toEqual(cvEn);
    expect(urls).toEqual(['http://localhost:3000/api/v1/cv?lang=en']);
  });

  it('ne lit pas la configuration quand la donnée vient déjà de la charge utile', async () => {
    const settings = vi.fn(() => fixtures);
    const cached: FetchCvDeps['asyncData'] = () =>
      Promise.resolve({ data: { value: cvFr }, error: { value: undefined } });

    expect(await fetchCv({ asyncData: cached, settings, fetch: neverCalled }, 'fr')).toBe(cvFr);
    expect(settings).not.toHaveBeenCalled();
  });

  it('relève l’erreur de la source : l’API ne répond pas, la génération échoue', async () => {
    const refused: FetchFn = () => Promise.reject(new TypeError('fetch failed'));
    const deps: FetchCvDeps = {
      asyncData: asyncDataRunning(),
      settings: () => ({ source: 'api', apiBaseUrl: 'http://localhost:3000' }),
      fetch: refused,
    };

    const failure = fetchCv(deps, 'fr');

    await expect(failure).rejects.toBeInstanceOf(CvSourceError);
    await expect(failure).rejects.toMatchObject({ kind: 'network' });
  });

  it('relève une configuration incohérente (source « api » sans URL)', async () => {
    const deps: FetchCvDeps = {
      asyncData: asyncDataRunning(),
      settings: () => ({ source: 'api', apiBaseUrl: undefined }),
      fetch: neverCalled,
    };

    await expect(fetchCv(deps, 'fr')).rejects.toMatchObject({ kind: 'config' });
  });

  it('relève une erreur qui n’est pas une Error, avec la langue', async () => {
    const asyncData: FetchCvDeps['asyncData'] = () =>
      Promise.resolve({ data: { value: undefined }, error: { value: 'panne' } });

    const failure = fetchCv({ asyncData, settings: () => fixtures, fetch: neverCalled }, 'en');

    await expect(failure).rejects.toThrow('Lecture du CV « en » impossible');
    await expect(failure).rejects.toHaveProperty('cause', 'panne');
  });

  it.each([null, undefined])('refuse une absence de donnée (%j) sans erreur', async (value) => {
    const asyncData: FetchCvDeps['asyncData'] = () =>
      Promise.resolve({ data: { value }, error: { value: null } } satisfies AsyncDataResult);

    await expect(
      fetchCv({ asyncData, settings: () => fixtures, fetch: neverCalled }, 'fr'),
    ).rejects.toThrow('Lecture du CV « fr » : aucune donnée reçue');
  });

  it('accepte une erreur vide (null) quand la donnée est là', async () => {
    const data: Cv = cvFr;
    const asyncData: FetchCvDeps['asyncData'] = () =>
      Promise.resolve({ data: { value: data }, error: { value: null } });

    expect(await fetchCv({ asyncData, settings: () => fixtures, fetch: neverCalled }, 'fr')).toBe(
      data,
    );
  });
});
