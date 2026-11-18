import { boolean, index, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';

export const tools = pgTable(
  'tools',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    url: text('url'),
    iconPath: text('icon_path'),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
  },
  (table) => [index('tools_published_sort_order_idx').on(table.published, table.sortOrder)],
);

export const toolsTranslations = pgTable(
  'tools_translations',
  {
    toolId: integer('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    name: text('name').notNull(),
    family: text('family').notNull(),
    description: text('description').notNull(),
  },
  (table) => [primaryKey({ columns: [table.toolId, table.locale] })],
);
