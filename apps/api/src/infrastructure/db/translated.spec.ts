import { PgDialect, alias, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { translated, translatedOrEmpty } from './translated.js';

const labels = pgTable('labels', {
  id: integer('id'),
  label: text('label'),
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

  it('accepte un type de colonne sans changer le SQL', () => {
    const plain = dialect.sqlToQuery(translated(en.note, fr.note));
    const typed = dialect.sqlToQuery(translated<string | null>(en.note, fr.note));

    expect(typed).toEqual(plain);
  });

  it('translatedOrEmpty ajoute une chaîne vide littérale en dernier recours', () => {
    const query = dialect.sqlToQuery(translatedOrEmpty(en.note, fr.note));

    expect(query.sql).toBe(`coalesce("en"."note", "fr"."note", '')`);
    expect(query.params).toEqual([]);
  });
});
