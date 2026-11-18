import { BadRequestException } from '@nestjs/common';
import { type Locale, LocaleQuerySchema } from '@siteperso/contracts';

/**
 * Lit `?lang=fr|en` des paramètres de requête (défaut `fr`). Appel explicite dans chaque
 * controller, pas de pipe magique (CLAUDE.md) ; un seul message pour toutes les routes de contenu.
 */
export function parseLocaleQuery(rawQuery: unknown): Locale {
  const query = LocaleQuerySchema.safeParse(rawQuery);
  if (!query.success) {
    throw new BadRequestException('Paramètre « lang » invalide : valeurs acceptées fr, en.');
  }
  return query.data.lang;
}
