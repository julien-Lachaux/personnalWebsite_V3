import { boolean, index, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';
import { skillGroups } from './skills.js';

export const resources = pgTable(
  'resources',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    url: text('url').notNull(),
    groupId: integer('group_id').references(() => skillGroups.id, { onDelete: 'set null' }),
    picturePath: text('picture_path'),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
  },
  (table) => [
    index('resources_published_sort_order_idx').on(table.published, table.sortOrder),
    index('resources_group_id_idx').on(table.groupId),
  ],
);

export const resourcesTranslations = pgTable(
  'resources_translations',
  {
    resourceId: integer('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    pictureAlt: text('picture_alt'),
  },
  (table) => [primaryKey({ columns: [table.resourceId, table.locale] })],
);
