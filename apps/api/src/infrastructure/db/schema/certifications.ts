import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';

export const certifications = pgTable(
  'certifications',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    issuer: text('issuer').notNull(),
    year: smallint('year').notNull(),
    url: text('url'),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('certifications_published_sort_order_idx').on(table.published, table.sortOrder),
  ],
);

export const certificationsTranslations = pgTable(
  'certifications_translations',
  {
    certificationId: integer('certification_id')
      .notNull()
      .references(() => certifications.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    name: text('name').notNull(),
  },
  (table) => [primaryKey({ columns: [table.certificationId, table.locale] })],
);
