import { boolean, index, integer, pgTable, primaryKey, smallint, text } from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';
import { skills } from './skills.js';

export const projects = pgTable(
  'projects',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    url: text('url'),
    repoUrl: text('repo_url'),
    imageDesktopPath: text('image_desktop_path'),
    imageMobilePath: text('image_mobile_path'),
    year: smallint('year'),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
  },
  (table) => [index('projects_published_sort_order_idx').on(table.published, table.sortOrder)],
);

export const projectsTranslations = pgTable(
  'projects_translations',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    imageAlt: text('image_alt'),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.locale] })],
);

export const projectSkills = pgTable(
  'project_skills',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.skillId] }),
    index('project_skills_skill_id_idx').on(table.skillId),
  ],
);
