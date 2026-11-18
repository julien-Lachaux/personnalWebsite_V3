// Schéma Drizzle dérivé du SQL de `db/migrations` (source de vérité). Aucun drizzle-kit.
import { customType, pgEnum } from 'drizzle-orm/pg-core';

export const experienceKind = pgEnum('experience_kind', [
  'employment',
  'freelance',
  'break',
  'mentoring',
]);

export const contractType = pgEnum('contract_type', ['cdi', 'freelance', 'none']);

export const workMode = pgEnum('work_mode', ['onsite', 'hybrid', 'remote']);

/** Domaine SQL `locale_code` (texte restreint à `fr` ou `en`). */
export const localeCode = customType<{ data: 'fr' | 'en' }>({
  dataType: () => 'locale_code',
});
