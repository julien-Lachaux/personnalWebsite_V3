import { getTableName, type SQL, sql } from 'drizzle-orm';
import { type AnyPgColumn, alias, type PgTable } from 'drizzle-orm/pg-core';

/**
 * Type d'une valeur de colonne, `null` compris si la colonne est nullable (`not null` absent du
 * SQL). Le type d'un champ traduit vient ainsi du schéma, pas d'une annotation écrite à la main.
 */
export type ColumnValue<TColumn extends AnyPgColumn> = TColumn['_']['notNull'] extends true
  ? TColumn['_']['data']
  : TColumn['_']['data'] | null;

/** Table de traductions : sa colonne `locale`, non nulle, sert de témoin de présence de la ligne. */
type TranslationTable = PgTable & { locale: AnyPgColumn };

/** Clés d'un alias de table de traductions qui désignent une colonne de données. */
type FieldKey<TTable extends TranslationTable> = {
  [K in keyof TTable & string]: TTable[K] extends AnyPgColumn ? K : never;
}[keyof TTable & string];

/**
 * Repli de langue PAR LIGNE, en SQL (docs/01, décision du 19 nov. 2026) : si la traduction demandée
 * (`en`, jointure `left join` sur la langue demandée) existe, la valeur vient d'elle, nulle comprise ;
 * sinon elle vient de la traduction française (`fr`, jointure `inner join`). Un champ nul de la ligne
 * `en` n'est donc jamais complété par le français : une entité n'est jamais servie en deux langues
 * (la complétude de la ligne `en` est garantie à l'écriture, par le contrôle des seeds).
 *
 * Les dépôts joignent deux alias de la table de traductions (`translationAliases`) ; pour
 * `lang = fr`, l'alias `en` porte la même ligne que `fr`, le résultat est le français. La présence
 * de la ligne `en` se lit sur sa colonne `locale`, non nulle dans la table : nulle seulement si la
 * jointure ne trouve rien.
 *
 * Le type TypeScript du champ est celui de la colonne (`ColumnValue`) : `string`, `string | null`
 * pour une colonne nullable, `string[]` pour un tableau. Il n'a aucun effet sur le SQL produit.
 */
export const translated = <TTable extends TranslationTable, TKey extends FieldKey<TTable>>(
  en: TTable,
  fr: Record<TKey, AnyPgColumn>,
  key: TKey,
): SQL<ColumnValue<Extract<TTable[TKey], AnyPgColumn>>> =>
  sql<
    ColumnValue<Extract<TTable[TKey], AnyPgColumn>>
  >`case when ${en.locale} is null then ${fr[key]} else ${en[key]} end`;

/**
 * Les deux alias `fr` (langue de référence, `inner join`) et `en` (langue demandée, `left join`)
 * d'une table de traductions, nommés d'après la table pour rester uniques dans une requête.
 */
export function translationAliases<TTable extends PgTable>(table: TTable) {
  const name = getTableName(table);
  return { fr: alias(table, `${name}_fr`), en: alias(table, `${name}_en`) };
}
