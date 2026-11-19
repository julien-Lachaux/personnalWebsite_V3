import {
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';
import { skills } from './skills.js';

/** Section « IA » : une seule ligne (id = 1), traduite par locale. */
export const aiOverview = pgTable('ai_overview', {
  id: smallint('id').primaryKey(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
});

export const aiOverviewTranslations = pgTable(
  'ai_overview_translations',
  {
    aiOverviewId: smallint('ai_overview_id')
      .notNull()
      .references(() => aiOverview.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    title: text('title').notNull(),
    inProductLabel: text('in_product_label').notNull(),
    // Un point par élément, texte brut.
    inProductItems: text('in_product_items').array().notNull(),
    dailyLabel: text('daily_label').notNull(),
    dailyText: text('daily_text').notNull(),
  },
  (table) => [primaryKey({ columns: [table.aiOverviewId, table.locale] })],
);

export const aiOverviewSkills = pgTable(
  'ai_overview_skills',
  {
    aiOverviewId: smallint('ai_overview_id')
      .notNull()
      .references(() => aiOverview.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.aiOverviewId, table.skillId] }),
    index('ai_overview_skills_skill_id_idx').on(table.skillId),
  ],
);
