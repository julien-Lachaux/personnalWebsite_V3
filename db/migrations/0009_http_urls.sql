-- Adresses web : http ou https uniquement.
-- Un `javascript:`, `data:`, `mailto:` ou `tel:` en base serait servi tel quel par l'API puis rendu
-- dans un `href` par le front (XSS stockée). Même règle que HttpUrlSchema (contrats), insensible
-- à la casse du protocole. Null reste permis pour les colonnes optionnelles.

alter table social_links
  add constraint social_links_url_check check (url ~* '^https?://');

alter table experiences
  add constraint experiences_company_url_check check (company_url ~* '^https?://');

alter table projects
  add constraint projects_url_check check (url ~* '^https?://'),
  add constraint projects_repo_url_check check (repo_url ~* '^https?://');

alter table tools
  add constraint tools_url_check check (url ~* '^https?://');

alter table resources
  add constraint resources_url_check check (url ~* '^https?://');

alter table certifications
  add constraint certifications_url_check check (url ~* '^https?://');

alter table education
  add constraint education_url_check check (url ~* '^https?://');
