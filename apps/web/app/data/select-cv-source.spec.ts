import { describe, expect, it } from 'vitest';

import { ApiCvSource } from './api-cv-source.js';
import { CvSourceError, type FetchFn } from './cv-source.js';
import { FixtureCvSource } from './fixture-cv-source.js';
import { cvFr } from './fixtures/cv.fr.js';
import { CV_SOURCES, createCvSource } from './select-cv-source.js';

const neverCalled: FetchFn = () => Promise.reject(new Error('aucun appel réseau attendu'));

function configError(call: () => unknown): CvSourceError {
  try {
    call();
  } catch (error) {
    if (error instanceof CvSourceError) return error;
    throw error;
  }
  throw new Error('la configuration aurait dû être refusée');
}

describe('createCvSource', () => {
  it('admet api et fixtures', () => {
    expect(CV_SOURCES).toEqual(['api', 'fixtures']);
  });

  it('« fixtures » sert les fixtures, sans URL ni réseau', async () => {
    const source = createCvSource({ source: 'fixtures', apiBaseUrl: undefined }, neverCalled);

    expect(source).toBeInstanceOf(FixtureCvSource);
    expect(await source.load('fr')).toEqual(cvFr);
  });

  it('tolère les espaces autour du nom de la source', () => {
    expect(
      createCvSource({ source: ' fixtures ', apiBaseUrl: undefined }, neverCalled),
    ).toBeInstanceOf(FixtureCvSource);
  });

  it('« api » lit l’API à l’URL de base donnée, avec le fetch injecté', async () => {
    const urls: string[] = [];
    const fetchFn: FetchFn = (input) => {
      urls.push(input as string);
      return Promise.resolve(new Response(JSON.stringify(cvFr)));
    };

    const source = createCvSource(
      { source: 'api', apiBaseUrl: ' http://localhost:3000/ ' },
      fetchFn,
    );

    expect(source).toBeInstanceOf(ApiCvSource);
    expect(await source.load('fr')).toEqual(cvFr);
    expect(urls).toEqual(['http://localhost:3000/api/v1/cv?lang=fr']);
  });

  it.each([undefined, '', '   '])('une source absente (%j) vaut « api »', (source) => {
    expect(
      createCvSource({ source, apiBaseUrl: 'http://localhost:3000' }, neverCalled),
    ).toBeInstanceOf(ApiCvSource);
  });

  it.each([undefined, '', '   '])(
    '« api » sans URL de base (%j) échoue explicitement, sans repli sur les fixtures',
    (apiBaseUrl) => {
      const error = configError(() => createCvSource({ source: 'api', apiBaseUrl }, neverCalled));

      expect(error.kind).toBe('config');
      expect(error.message).toBe(
        "URL de base de l'API absente : elle est obligatoire pour la source « api »",
      );
    },
  );

  it('l’absence de source et d’URL échoue aussi (build de production non configuré)', () => {
    const error = configError(() =>
      createCvSource({ source: undefined, apiBaseUrl: undefined }, neverCalled),
    );

    expect(error.kind).toBe('config');
  });

  it('une URL de base invalide échoue explicitement', () => {
    const error = configError(() =>
      createCvSource({ source: 'api', apiBaseUrl: 'ftp://example.org' }, neverCalled),
    );

    expect(error.kind).toBe('config');
    expect(error.message).toContain("URL de base de l'API invalide");
  });

  it('une source inconnue échoue en listant les valeurs admises', () => {
    const error = configError(() =>
      createCvSource({ source: 'mock', apiBaseUrl: 'http://localhost:3000' }, neverCalled),
    );

    expect(error.kind).toBe('config');
    expect(error.message).toBe(
      'Source du CV inconnue : « mock » (valeurs admises : api, fixtures)',
    );
  });
});
