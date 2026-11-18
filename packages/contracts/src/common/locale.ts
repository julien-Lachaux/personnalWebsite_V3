import { z } from 'zod';

/** Locales servies par l'API. `fr` est obligatoire en base, `en` se replie sur `fr`. */
export const LocaleSchema = z.enum(['fr', 'en']).meta({
  id: 'Locale',
  description:
    "Langue du contenu. Défaut : `fr`. Si une traduction `en` manque, l'API renvoie le `fr`.",
});

export type Locale = z.infer<typeof LocaleSchema>;

export const DEFAULT_LOCALE: Locale = 'fr';

/** Paramètres de requête communs aux endpoints de contenu (`?lang=fr|en`). */
export const LocaleQuerySchema = z
  .object({
    lang: LocaleSchema.default(DEFAULT_LOCALE),
  })
  .meta({ id: 'LocaleQuery' });

export type LocaleQuery = z.infer<typeof LocaleQuerySchema>;
