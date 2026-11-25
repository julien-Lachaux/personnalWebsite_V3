import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';

export const skillGroups = pgTable(
  'skill_groups',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [index('skill_groups_published_sort_order_idx').on(table.published, table.sortOrder)],
);

export const skillGroupsTranslations = pgTable(
  'skill_groups_translations',
  {
    skillGroupId: integer('skill_group_id')
      .notNull()
      .references(() => skillGroups.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    name: text('name').notNull(),
    description: text('description'),
  },
  (table) => [primaryKey({ columns: [table.skillGroupId, table.locale] })],
);

export const skills = pgTable(
  'skills',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    groupId: integer('group_id')
      .notNull()
      .references(() => skillGroups.id, { onDelete: 'restrict' }),
    level: smallint('level').notNull(),
    icon: text('icon').notNull(),
    iconPath: text('icon_path'),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
    // Rang dans la stack principale (BF-3) : null = hors stack principale ; unique et > 0 quand renseigné.
    mainStackOrder: smallint('main_stack_order'),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('skills_main_stack_order_idx')
      .on(table.mainStackOrder)
      .where(sql`${table.mainStackOrder} is not null`),
    index('skills_group_published_sort_order_idx').on(
      table.groupId,
      table.published,
      table.sortOrder,
    ),
  ],
);

export const skillsTranslations = pgTable(
  'skills_translations',
  {
    skillId: integer('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    name: text('name').notNull(),
  },
  (table) => [primaryKey({ columns: [table.skillId, table.locale] })],
);
