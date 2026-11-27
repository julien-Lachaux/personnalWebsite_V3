import { describe, expect, it } from 'vitest';

import { BROWSER_CV_SOURCE_MESSAGE, createCvSource } from './browser-cv-source.js';
import { CvSourceError, type FetchFn } from './cv-source.js';

const neverCalled: FetchFn = () => Promise.reject(new Error('aucun appel réseau attendu'));

describe('createCvSource (navigateur du site généré)', () => {
  it.each([
    { source: 'fixtures', apiBaseUrl: undefined },
    { source: 'api', apiBaseUrl: 'http://localhost:3000' },
    { source: undefined, apiBaseUrl: undefined },
  ])('refuse toute lecture, sans repli sur une source (%j)', (settings) => {
    let failure: unknown;
    try {
      createCvSource(settings, neverCalled);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(CvSourceError);
    expect((failure as CvSourceError).kind).toBe('config');
    expect((failure as CvSourceError).message).toBe(BROWSER_CV_SOURCE_MESSAGE);
  });

  it('explique que le CV vient de la charge utile de la page', () => {
    expect(BROWSER_CV_SOURCE_MESSAGE).toBe(
      "Le CV n'est lu qu'à la génération du site : dans le navigateur, il vient de la charge utile de la page",
    );
  });
});
