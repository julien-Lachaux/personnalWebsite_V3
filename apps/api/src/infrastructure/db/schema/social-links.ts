import { boolean, index, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';

export const socialLinks = pgTable(
  'social_links',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    kind: text('kind').notNull(),
    url: text('url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
  },
  (table) => [index('social_links_published_sort_order_idx').on(table.published, table.sortOrder)],
);

export const socialLinksTranslations = pgTable(
  'social_links_translations',
  {
    socialLinkId: integer('social_link_id')
      .notNull()
      .references(() => socialLinks.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    label: text('label').notNull(),
  },
  (table) => [primaryKey({ columns: [table.socialLinkId, table.locale] })],
);
