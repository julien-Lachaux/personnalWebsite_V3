import { boolean, index, integer, pgTable, primaryKey, smallint, text } from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';

export const education = pgTable(
  'education',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    institution: text('institution').notNull(),
    yearStart: smallint('year_start').notNull(),
    yearEnd: smallint('year_end'),
    url: text('url'),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
  },
  (table) => [index('education_published_sort_order_idx').on(table.published, table.sortOrder)],
);

export const educationTranslations = pgTable(
  'education_translations',
  {
    educationId: integer('education_id')
      .notNull()
      .references(() => education.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    title: text('title').notNull(),
    description: text('description'),
  },
  (table) => [primaryKey({ columns: [table.educationId, table.locale] })],
);
