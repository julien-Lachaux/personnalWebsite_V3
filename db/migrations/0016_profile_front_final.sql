-- BF-1 (brief back-001) : état final du profil pour le design v6.
-- Les neuf colonnes ajoutées par 0011 passent `not null`, les huit colonnes texte sont non vides et
-- `taglines` compte au moins une accroche, sans élément vide ni nul (même motif que `paragraphs` de
-- 0014). Les colonnes headline, bio et availability, plus lues par l'API, sont supprimées.

alter table profile_translations
  alter column title_badge set not null,
  alter column taglines set not null,
  alter column intro set not null,
  alter column mission set not null,
  alter column current_activity set not null,
  alter column seeking_format set not null,
  alter column seeking_location set not null,
  alter column seeking_availability set not null,
  alter column cv_path set not null,
  add constraint profile_translations_title_badge_check check (title_badge <> ''),
  add constraint profile_translations_intro_check check (intro <> ''),
  add constraint profile_translations_mission_check check (mission <> ''),
  add constraint profile_translations_current_activity_check check (current_activity <> ''),
  add constraint profile_translations_seeking_format_check check (seeking_format <> ''),
  add constraint profile_translations_seeking_location_check check (seeking_location <> ''),
  add constraint profile_translations_seeking_availability_check check (seeking_availability <> ''),
  add constraint profile_translations_cv_path_check check (cv_path <> ''),
  add constraint profile_translations_taglines_check check (
    cardinality(taglines) >= 1
    and array_position(taglines, '') is null
    and array_position(taglines, null::text) is null
  ),
  drop column headline,
  drop column bio,
  drop column availability;
