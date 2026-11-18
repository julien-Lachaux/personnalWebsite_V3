import { getTableName, type SQL, sql } from 'drizzle-orm';
import { type AnyPgColumn, alias, type PgTable } from 'drizzle-orm/pg-core';

/**
 * Type d'une valeur de colonne, `null` compris si la colonne est nullable (`not null` absent du
 * SQL). Le type d'un champ traduit vient ainsi du schéma, pas d'une annotation écrite à la main.
 */
export type ColumnValue<TColumn extends AnyPgColumn> = TColumn['_']['notNull'] extends true
  ? TColumn['_']['data']
  : TColumn['_']['data'] | null;

/**
 * Repli de langue en SQL, champ par champ : la traduction demandée (`en`, jointure `left join`
 * sur la langue demandée) si elle existe et n'est pas nulle, sinon le français (`fr`, jointure
 * `inner join`). Les dépôts joignent deux alias de la table de traductions
 * (`translationAliases`) ; pour `lang = fr`, l'alias `en` est vide (ou porte la même ligne), le
 * résultat est le français.
 *
 * Le type TypeScript du champ est celui de la colonne (`ColumnValue`) : `string`, `string | null`
 * pour une colonne nullable, `string[]` pour un tableau. Il n'a aucun effet sur le SQL produit.
 */
export const translated = <TColumn extends AnyPgColumn>(
  en: AnyPgColumn & { _: { data: TColumn['_']['data'] } },
  fr: TColumn,
): SQL<ColumnValue<TColumn>> => sql<ColumnValue<TColumn>>`coalesce(${en}, ${fr})`;

/**
 * Les deux alias `fr` (langue de référence, `inner join`) et `en` (langue demandée, `left join`)
 * d'une table de traductions, nommés d'après la table pour rester uniques dans une requête.
 */
export function translationAliases<TTable extends PgTable>(table: TTable) {
  const name = getTableName(table);
  return { fr: alias(table, `${name}_fr`), en: alias(table, `${name}_en`) };
}
