-- BF-16 (brief back-006, RS-1 de la revue sécurité F10, gravité faible) : le motif du contrat
-- `cvPath` refuse désormais l'antislash ; en base, `cv_path` reste sous `/cv/`
-- (`/cv/cv-fr.pdf`, `/cv/cv-en.pdf` dans les seeds). Idempotente.
-- `SITE_PATH_PATTERN` (packages/contracts/src/profile/profile.ts) garde la règle générique de
-- chemin statique ; cette contrainte s'ajoute par-dessus la contrainte `cv_path <> ''` (0016).

alter table profile_translations
  drop constraint if exists profile_translations_cv_path_prefix_check;

alter table profile_translations
  add constraint profile_translations_cv_path_prefix_check check (cv_path like '/cv/%');
