// Validation d'un CV par le schéma `Cv` des contrats, avec une erreur qui nomme le champ fautif.
import { CvSchema, type Cv, type Locale } from '@siteperso/contracts';

import { CvSourceError } from './cv-source.js';

/** Nombre maximal de champs fautifs cités dans le message (le premier suffit à corriger). */
const MAX_REPORTED_ISSUES = 5;

/**
 * Valide `data` contre `CvSchema` et vérifie que la langue servie est celle demandée.
 * `origin` décrit la provenance (« GET https://… », « fixture fr ») pour le message d'erreur.
 */
export function parseCv(data: unknown, locale: Locale, origin: string): Cv {
  const parsed = CvSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, MAX_REPORTED_ISSUES)
      .map((issue) => `${issue.path.map(String).join('.') || '(racine)'} : ${issue.message}`);
    throw new CvSourceError(
      'invalid',
      `Réponse non conforme au contrat Cv (${origin}) : ${issues.join(' ; ')}`,
      { cause: parsed.error },
    );
  }
  if (parsed.data.locale !== locale) {
    throw new CvSourceError(
      'invalid',
      `Langue inattendue (${origin}) : « ${locale} » demandée, « ${parsed.data.locale} » reçue`,
    );
  }
  return parsed.data;
}
