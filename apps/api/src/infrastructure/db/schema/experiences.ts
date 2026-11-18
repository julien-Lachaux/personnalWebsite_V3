import { boolean, date, index, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { contractType, experienceKind, localeCode, workMode } from './enums.js';
import { skills } from './skills.js';

export const experiences = pgTable(
  'experiences',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    kind: experienceKind('kind').notNull(),
    company: text('company'),
    companyUrl: text('company_url'),
    logoPath: text('logo_path'),
    contractType: contractType('contract_type'),
    workMode: workMode('work_mode'),
    dateStart: date('date_start', { mode: 'string' }).notNull(),
    dateEnd: date('date_end', { mode: 'string' }),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
  },
  (table) => [
    index('experiences_published_date_start_idx').on(table.published, table.dateStart.desc()),
  ],
);

export const experiencesTranslations = pgTable(
  'experiences_translations',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    jobTitle: text('job_title').notNull(),
    location: text('location'),
    summary: text('summary').notNull(),
    achievements: text('achievements').array().notNull().default([]),
    logoAlt: text('logo_alt'),
    stackLabel: text('stack_label'),
  },
  (table) => [primaryKey({ columns: [table.experienceId, table.locale] })],
);

export const experienceSkills = pgTable(
  'experience_skills',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.experienceId, table.skillId] }),
    index('experience_skills_skill_id_idx').on(table.skillId),
  ],
);
