import { type Cv } from '@siteperso/contracts';
import { describe, expect, it } from 'vitest';

import { type FetchFn } from './cv-source.js';
import { fetchCvValue, type FetchCvDeps } from './fetch-cv.js';
import { cvEn } from './fixtures/cv.en.js';
import { cvFr } from './fixtures/cv.fr.js';

// Lecture d'une seule valeur du CV au build (lot 31, page « travaux en cours ») : la charge utile
// (ce que le gestionnaire rend à `useAsyncData`) ne contient que la valeur choisie, sous une clé
// distincte de celle du CV entier ; une sélection qui lève fait échouer la lecture.

const neverCalled: FetchFn = () => Promise.reject(new Error('aucun appel réseau attendu'));
const fixtures = { source: 'fixtures', apiBaseUrl: undefined };

/** Doublure de `useAsyncData` qui garde, par clé, ce que le gestionnaire a rendu (la charge utile). */
function recording<T>(payload: Map<string, unknown>): FetchCvDeps<T> {
  return {
    asyncData: async (key, handler) => {
      try {
        const value = await handler();
        payload.set(key, value);
        return { data: { value }, error: { value: undefined } };
      } catch (error) {
        return { data: { value: undefined }, error: { value: error } };
      }
    },
    settings: () => fixtures,
    fetch: neverCalled,
  };
}

const profileTitle = (cv: Cv): string => cv.profile.title;

describe('fetchCvValue', () => {
  it('ne range dans la charge utile que la valeur choisie, sous `cv-<langue>-<nom>`', async () => {
    const payload = new Map<string, unknown>();

    expect(await fetchCvValue(recording<string>(payload), 'fr', 'title', profileTitle)).toBe(
      cvFr.profile.title,
    );
    expect(await fetchCvValue(recording<string>(payload), 'en', 'title', profileTitle)).toBe(
      cvEn.profile.title,
    );
    expect([...payload.entries()]).toEqual([
      ['cv-fr-title', cvFr.profile.title],
      ['cv-en-title', cvEn.profile.title],
    ]);
  });

  it('relève telle quelle l’erreur levée par la sélection', async () => {
    const failure = new Error('valeur absente');
    const select = (): string => {
      throw failure;
    };

    await expect(fetchCvValue(recording<string>(new Map()), 'fr', 'x', select)).rejects.toBe(
      failure,
    );
  });

  it('refuse une valeur vide plutôt que de la rendre', async () => {
    const select = (): string | null => null;

    await expect(
      fetchCvValue(recording<string | null>(new Map()), 'en', 'x', select),
    ).rejects.toThrow('Lecture du CV « en » : aucune donnée reçue');
  });
});
