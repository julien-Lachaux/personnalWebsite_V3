import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearNuxtData, useNuxtApp, useRuntimeConfig } from '#imports';

import { cvEn } from '../data/fixtures/cv.en.js';
import { cvFr } from '../data/fixtures/cv.fr.js';
import { useCv } from './use-cv.js';

// `useCv` relie `app/data/` à Nuxt : configuration privée lue au `setup`, lecture par `useAsyncData`
// (clé par langue, charge utile), erreur relevée. Exécuté dans le contexte de l'application de test.

interface PrivateConfig {
  cvSource: string;
  apiBaseUrl: string;
}

let original: PrivateConfig;

function configure(settings: PrivateConfig): void {
  const config = useRuntimeConfig();
  config.cvSource = settings.cvSource;
  config.apiBaseUrl = settings.apiBaseUrl;
}

function read(locale: 'fr' | 'en'): Promise<unknown> {
  return useNuxtApp().runWithContext(() => useCv(locale));
}

beforeEach(() => {
  const config = useRuntimeConfig();
  original = { cvSource: config.cvSource, apiBaseUrl: config.apiBaseUrl };
  clearNuxtData();
});

afterEach(() => {
  configure(original);
  clearNuxtData();
});

describe('useCv', () => {
  it('sert les fixtures de la langue demandée avec NUXT_CV_SOURCE=fixtures', async () => {
    configure({ cvSource: 'fixtures', apiBaseUrl: '' });

    expect(await read('fr')).toEqual(cvFr);
    expect(await read('en')).toEqual(cvEn);
  });

  it('range la lecture dans la charge utile, sous la clé de la langue', async () => {
    configure({ cvSource: 'fixtures', apiBaseUrl: '' });

    await read('fr');

    expect(useNuxtApp().payload.data['cv-fr']).toEqual(cvFr);
    expect(useNuxtApp().payload.data['cv-en']).toBeUndefined();
  });

  it('lit GET /api/v1/cv?lang= de l’API configurée par défaut (source vide)', async () => {
    // `fetch` de l'environnement de test sert les adresses enregistrées sans réseau.
    const requests: string[] = [];
    registerEndpoint('http://api.test:3999/api/v1/cv', {
      method: 'GET',
      handler: (event) => {
        requests.push(event.path);
        return cvEn;
      },
    });
    configure({ cvSource: '', apiBaseUrl: 'http://api.test:3999' });

    expect(await read('en')).toEqual(cvEn);
    // Le registre de l'environnement préfixe l'adresse enregistrée par « /_ ».
    expect(requests).toEqual(['/_http://api.test:3999/api/v1/cv?lang=en']);
  });

  it('échoue, sans repli sur les fixtures, quand l’API n’est pas configurée', async () => {
    configure({ cvSource: 'api', apiBaseUrl: '' });

    await expect(read('fr')).rejects.toThrow(
      "URL de base de l'API absente : elle est obligatoire pour la source « api »",
    );
  });

  it('échoue quand l’API répond en erreur', async () => {
    registerEndpoint('http://api.test:3998/api/v1/cv', {
      method: 'GET',
      handler: () => new Response('{"detail":"base indisponible"}', { status: 503 }),
    });
    configure({ cvSource: 'api', apiBaseUrl: 'http://api.test:3998' });

    await expect(read('fr')).rejects.toThrow(
      "L'API a répondu HTTP 503 (GET http://api.test:3998/api/v1/cv?lang=fr) : base indisponible",
    );
  });
});
