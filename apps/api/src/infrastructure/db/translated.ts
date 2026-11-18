import { type SQL, sql } from 'drizzle-orm';
import { type AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Repli de langue en SQL, champ par champ : la traduction demandée (`en`, jointure `left join`
 * sur la langue demandée) si elle existe et n'est pas nulle, sinon le français (`fr`, jointure
 * `inner join`). Les dépôts joignent deux alias de la table de traductions ; pour `lang = fr`,
 * l'alias `en` est vide (ou porte la même ligne), le résultat est le français.
 *
 * `T` est le type TypeScript de la colonne (`string` par défaut, `string | null` pour une colonne
 * nullable, `string[]` pour un tableau) : il n'a aucun effet sur le SQL produit.
 */
export const translated = <T = string>(en: AnyPgColumn, fr: AnyPgColumn): SQL<NoInfer<T>> =>
  sql<T>`coalesce(${en}, ${fr})`;
