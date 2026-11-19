import { type SQL } from 'drizzle-orm';
import { PgDialect, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { translated, translationAliases } from './translated.js';

const labels = pgTable('labels', {
  id: integer('id'),
  locale: text('locale').notNull(),
  label: text('label').notNull(),
  note: text('note'),
});
const { fr, en } = translationAliases(labels);
const dialect = new PgDialect();

describe('translated', () => {
  it('sert la ligne en entière ou, à défaut, la ligne fr entière, sans paramètre lié', () => {
    const query = dialect.sqlToQuery(translated(en, fr, 'label'));

    expect(query.sql).toBe(
      'case when "labels_en"."locale" is null then "labels_fr"."label" else "labels_en"."label" end',
    );
    expect(query.params).toEqual([]);
  });

  it('ne complète pas un champ nul de la ligne en par le français (pas de coalesce)', () => {
    const query = dialect.sqlToQuery(translated(en, fr, 'note'));

    expect(query.sql).not.toContain('coalesce');
    expect(query.sql).toBe(
      'case when "labels_en"."locale" is null then "labels_fr"."note" else "labels_en"."note" end',
    );
  });

  it('type le champ depuis la colonne : nullable seulement si la colonne l’est', () => {
    expectTypeOf(translated(en, fr, 'label')).toEqualTypeOf<SQL<string>>();
    expectTypeOf(translated(en, fr, 'note')).toEqualTypeOf<SQL<string | null>>();
  });
});

describe('translationAliases', () => {
  it('nomme les deux alias d’après la table, pour qu’ils restent uniques dans une requête', () => {
    const sql = dialect.sqlToQuery(translated(en, fr, 'label')).sql;

    expect(sql).toContain('"labels_en"');
    expect(sql).toContain('"labels_fr"');
  });
});
