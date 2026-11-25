import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';

export const recommendations = pgTable(
  'recommendations',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    authorName: text('author_name').notNull(),
    recommendedOn: date('recommended_on', { mode: 'string' }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('recommendations_published_sort_order_idx').on(table.published, table.sortOrder),
  ],
);

export const recommendationsTranslations = pgTable(
  'recommendations_translations',
  {
    recommendationId: integer('recommendation_id')
      .notNull()
      .references(() => recommendations.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    authorRole: text('author_role').notNull(),
    relationship: text('relationship').notNull(),
    // Un paragraphe par élément, texte brut.
    paragraphs: text('paragraphs').array().notNull(),
  },
  (table) => [primaryKey({ columns: [table.recommendationId, table.locale] })],
);
