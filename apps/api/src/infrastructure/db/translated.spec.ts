import { type SQL } from 'drizzle-orm';
import { PgDialect, alias, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { translated, translationAliases } from './translated.js';

const labels = pgTable('labels', {
  id: integer('id'),
  label: text('label').notNull(),
  note: text('note'),
});
const fr = alias(labels, 'fr');
const en = alias(labels, 'en');
const dialect = new PgDialect();

describe('translated', () => {
  it('produit coalesce(en, fr) sans paramètre lié', () => {
    const query = dialect.sqlToQuery(translated(en.label, fr.label));

    expect(query.sql).toBe('coalesce("en"."label", "fr"."label")');
    expect(query.params).toEqual([]);
  });

  it('type le champ depuis la colonne : nullable seulement si la colonne l’est', () => {
    expectTypeOf(translated(en.label, fr.label)).toEqualTypeOf<SQL<string>>();
    expectTypeOf(translated(en.note, fr.note)).toEqualTypeOf<SQL<string | null>>();
  });
});

describe('translationAliases', () => {
  it('nomme les deux alias d’après la table, pour qu’ils restent uniques dans une requête', () => {
    const aliases = translationAliases(labels);
    const query = dialect.sqlToQuery(translated(aliases.en.label, aliases.fr.label));

    expect(query.sql).toBe('coalesce("labels_en"."label", "labels_fr"."label")');
  });
});
