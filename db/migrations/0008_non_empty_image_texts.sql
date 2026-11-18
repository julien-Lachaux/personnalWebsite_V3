-- Chemins d'images et textes alternatifs : jamais de chaîne vide.
-- Le contrat d'API (Image) exige path et alt non vides ; une chaîne vide en base donnerait une
-- réponse invalide (500). Null reste permis : l'image est alors simplement absente.

alter table profile
  add constraint profile_picture_path_check check (picture_path <> '');

alter table profile_translations
  add constraint profile_translations_picture_alt_check check (picture_alt <> '');

alter table experiences
  add constraint experiences_logo_path_check check (logo_path <> '');

alter table experiences_translations
  add constraint experiences_translations_logo_alt_check check (logo_alt <> '');

alter table projects
  add constraint projects_image_desktop_path_check check (image_desktop_path <> ''),
  add constraint projects_image_mobile_path_check check (image_mobile_path <> '');

alter table projects_translations
  add constraint projects_translations_image_alt_check check (image_alt <> '');

alter table resources
  add constraint resources_picture_path_check check (picture_path <> '');

alter table resources_translations
  add constraint resources_translations_picture_alt_check check (picture_alt <> '');
