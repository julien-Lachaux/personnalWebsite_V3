import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearNuxtData, useNuxtApp, useRuntimeConfig } from '#imports';

import { CvReadError, useCv } from './use-cv.js';

// Une lecture en échec est relevée en `CvReadError` (une `Error` simple, pas une `NuxtError`) : le
// prérendu journalise alors sa cause au lieu d'un « [500] Server Error » muet.

let original: { cvSource: string; apiBaseUrl: string };

beforeEach(() => {
  const config = useRuntimeConfig();
  original = { cvSource: config.cvSource, apiBaseUrl: config.apiBaseUrl };
  config.cvSource = 'api';
  config.apiBaseUrl = '';
  clearNuxtData();
});

afterEach(() => {
  const config = useRuntimeConfig();
  config.cvSource = original.cvSource;
  config.apiBaseUrl = original.apiBaseUrl;
  clearNuxtData();
});

describe('useCv : erreur relevée', () => {
  it('lève une CvReadError au message de la cause, qui n’est pas une erreur HTTP de Nuxt', async () => {
    const error: unknown = await useNuxtApp()
      .runWithContext(() => useCv('fr'))
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(CvReadError);
    expect(error).toMatchObject({
      name: 'CvReadError',
      message: "URL de base de l'API absente : elle est obligatoire pour la source « api »",
    });
    expect((error as Error & { statusCode?: number }).statusCode).toBeUndefined();
    expect((error as Error).cause).toBeInstanceOf(Error);
  });
});
