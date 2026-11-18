import { boolean, index, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { CEFR_LEVELS } from '../../../domain/languages/language.js';
import { localeCode } from './enums.js';

export const languages = pgTable(
  'languages',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    code: text('code').notNull().unique(),
    // Mêmes valeurs que la contrainte SQL `languages_cefr_level_check`.
    cefrLevel: text('cefr_level', { enum: CEFR_LEVELS }),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
  },
  (table) => [index('languages_published_sort_order_idx').on(table.published, table.sortOrder)],
);

export const languagesTranslations = pgTable(
  'languages_translations',
  {
    languageId: integer('language_id')
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    name: text('name').notNull(),
    levelLabel: text('level_label').notNull(),
  },
  (table) => [primaryKey({ columns: [table.languageId, table.locale] })],
);
