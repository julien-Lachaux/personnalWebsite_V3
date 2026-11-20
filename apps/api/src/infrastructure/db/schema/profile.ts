import { pgTable, primaryKey, smallint, text, timestamp } from 'drizzle-orm/pg-core';

import { localeCode } from './enums.js';

export const profile = pgTable('profile', {
  id: smallint('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  picturePath: text('picture_path').notNull(),
  location: text('location').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
});

export const profileTranslations = pgTable(
  'profile_translations',
  {
    profileId: smallint('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    locale: localeCode('locale').notNull(),
    title: text('title').notNull(),
    pictureAlt: text('picture_alt').notNull(),
    // Colonnes du design v6 (BF-1).
    titleBadge: text('title_badge').notNull(),
    taglines: text('taglines').array().notNull(),
    intro: text('intro').notNull(),
    mission: text('mission').notNull(),
    currentActivity: text('current_activity').notNull(),
    seekingFormat: text('seeking_format').notNull(),
    seekingLocation: text('seeking_location').notNull(),
    seekingAvailability: text('seeking_availability').notNull(),
    cvPath: text('cv_path').notNull(),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.locale] })],
);
