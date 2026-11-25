// Choix de la source du CV par la configuration (docs/04, F4-04) : fonction pure, sans Nuxt.
// `api` (défaut) lit l'API au build ; `fixtures` sert les fixtures du dépôt (développement,
// parcours Playwright). Le défaut est `api` : un build de production sans configuration ne peut pas
// embarquer des fixtures par oubli, il échoue.
import { ApiCvSource } from './api-cv-source.js';
import { CvSourceError, type CvSource, type FetchFn } from './cv-source.js';
import { FixtureCvSource } from './fixture-cv-source.js';

/** Valeurs admises pour le choix de la source. */
export const CV_SOURCES = ['api', 'fixtures'] as const;
export type CvSourceName = (typeof CV_SOURCES)[number];

export interface CvSourceSettings {
  /** `api` ou `fixtures` ; absent ou vide : `api`. */
  readonly source: string | undefined;
  /** URL de base de l'API (sans `/api/v1`) : obligatoire pour la source `api`. */
  readonly apiBaseUrl: string | undefined;
}

/** Construit la source choisie ; lève une `CvSourceError` (`config`) si la configuration est incohérente. */
export function createCvSource(settings: CvSourceSettings, fetchFn: FetchFn): CvSource {
  const requested = settings.source?.trim();
  const name = requested === undefined || requested === '' ? 'api' : requested;
  if (name === 'fixtures') return new FixtureCvSource();
  if (name !== 'api') {
    throw new CvSourceError(
      'config',
      `Source du CV inconnue : « ${name} » (valeurs admises : ${CV_SOURCES.join(', ')})`,
    );
  }
  const baseUrl = settings.apiBaseUrl?.trim();
  if (!baseUrl) {
    throw new CvSourceError(
      'config',
      "URL de base de l'API absente : elle est obligatoire pour la source « api »",
    );
  }
  return new ApiCvSource({ baseUrl, fetch: fetchFn });
}
