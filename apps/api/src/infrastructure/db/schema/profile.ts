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
    headline: text('headline').notNull(),
    bio: text('bio').notNull(),
    availability: text('availability').notNull(),
    pictureAlt: text('picture_alt').notNull(),
    // Colonnes du design v6 (BF-1), nullables le temps de la transition ; `not null` à l'étape suivante.
    titleBadge: text('title_badge'),
    taglines: text('taglines').array(),
    intro: text('intro'),
    mission: text('mission'),
    currentActivity: text('current_activity'),
    seekingFormat: text('seeking_format'),
    seekingLocation: text('seeking_location'),
    seekingAvailability: text('seeking_availability'),
    cvPath: text('cv_path'),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.locale] })],
);
