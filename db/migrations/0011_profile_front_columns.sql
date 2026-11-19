-- BF-1 (brief back-001) : profil restructuré pour le design v6, étape d'ajout.
-- Neuf colonnes s'ajoutent à profile_translations. Elles sont nullables à cette étape : les lignes
-- existantes et le code qui écrit encore headline, bio et availability restent valides. Elles
-- passeront `not null` (avec non-vide, et taglines d'au moins un élément) quand les anciennes colonnes
-- seront supprimées, dans une migration ultérieure du même lot.

alter table profile_translations
  add column title_badge text,
  add column taglines text[],
  add column intro text,
  add column mission text,
  add column current_activity text,
  add column seeking_format text,
  add column seeking_location text,
  add column seeking_availability text,
  -- Chemin d'un fichier statique du front, par langue (/cv/cv-fr.pdf, /cv/cv-en.pdf).
  add column cv_path text;
