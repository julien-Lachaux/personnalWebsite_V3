# Modèle de données V3

Décisions (18 novembre 2026) : pas de comptes, pas d'auth, pas d'admin, pas de CRUD. L'API est
en lecture seule, le contenu vit dans des migrations et seeds SQL versionnés. Aucune donnée
personnelle de contact (e-mail, téléphone) en base : le contact est géré par le front. Multilingue FR/EN
dès le départ. Accessibilité complète : toute image a un texte alternatif traduit.

## Principes

- PostgreSQL, SQL explicite (snake_case), pas de magie ORM : le schéma doit se relire tel quel
  depuis Rust (sqlx) sans réinterprétation.
- Contenu et présentation séparés : aucune couleur, décoration, icône de nav ou ordre de menu en
  base. Seul `sort_order` ordonne les listes.
- i18n par tables de traduction `<table>_translations (…_id, locale, …)` avec clé primaire
  composite. Locale `fr` obligatoire, `en` optionnelle avec repli sur `fr` côté API.
- Chaque entité publiable a `published boolean not null default true` et `sort_order int`.
- `slug` unique et stable sur chaque entité : c'est la clé naturelle d'upsert des seeds.
- Images : chemins relatifs vers des fichiers statiques servis par le front (`/images/...`),
  jamais de binaire en base. Le texte alternatif est traduit.
- Pas de HTML en base. Texte brut ou Markdown léger (à trancher au moment du design), rendu par le front.

## Tables

### profile (une seule ligne, id = 1)
| colonne | type | note |
|---|---|---|
| id | smallint PK | toujours 1 |
| first_name, last_name | text | |
| picture_path | text | |
| location | text | « Melun, Île-de-France » |

profile_translations : profile_id, locale, title (« Développeur full-stack TypeScript senior »),
headline (accroche), bio, availability (« Disponible pour des missions »), picture_alt.

### social_links
id, slug, kind (`github`, `linkedin`, `website`, …), url, sort_order, published.
social_links_translations : label.

### skill_groups
id, slug, sort_order, published.
skill_groups_translations : name, description.

### skills
id, slug, group_id FK, level smallint (1-5), icon text (slug devicon ou chemin SVG), icon_path text null,
sort_order, published.
skills_translations : name (la plupart sont des noms propres, le `en` est alors identique).

### experiences
| colonne | type | note |
|---|---|---|
| id, slug | | |
| kind | enum `employment` / `freelance` / `break` / `mentoring` | la pause pro rentre ici |
| company | text null | null pour une pause |
| company_url | text null | |
| logo_path | text null | |
| contract_type | enum `cdi` / `freelance` / `none` null | |
| work_mode | enum `onsite` / `hybrid` / `remote` null | |
| date_start | date | 1er jour du mois |
| date_end | date null | null = en cours |
| sort_order, published | | tri par défaut : date_start desc |

experiences_translations : job_title, location, summary, achievements `text[]`, logo_alt, stack_label
(« Huile de coude » pour la pause).

experience_skills : experience_id, skill_id, sort_order (PK composite).

### projects (ex-réalisations)
id, slug, url, repo_url, image_desktop_path, image_mobile_path, year, sort_order, published.
projects_translations : title, description, image_alt.
project_skills : project_id, skill_id, sort_order.

### tools
id, slug, url, icon_path, sort_order, published.
tools_translations : name, family (« IDE », « API »…), description.

### resources (ex-favoris)
id, slug, url, group_id FK skill_groups null, picture_path, sort_order, published.
resources_translations : name, description, picture_alt.

### certifications
id, slug, issuer, year smallint, url null, sort_order, published.
certifications_translations : name.

### education
id, slug, institution, year_start smallint, year_end smallint null, url null, sort_order, published.
education_translations : title, description.

### languages
id, slug, code (`fr`, `en`), cefr_level text null (`C1`), sort_order, published.
languages_translations : name, level_label (« langue maternelle », « professionnel »).

## Ce qui disparaît de la V2
panels, color_themes (présentation), colonnes github/linkedin/freelance_website du profil
(remplacées par social_links), `description` HTML des expériences (remplacée par summary + achievements).

## Contrat d'API (lecture seule, préfixe `/api/v1`, `?lang=fr|en`, défaut `fr`)
- `GET /profile`, `/social-links`, `/skill-groups` (avec skills imbriqués), `/skills`,
  `/experiences` (avec skills), `/projects`, `/tools`, `/resources`, `/certifications`,
  `/education`, `/languages`
- `GET /cv` : agrégat de tout ce qui précède en un appel (pour la génération statique du front)
- Pas d'endpoint de contact : le `mailto:` et le lien LinkedIn sont gérés dans le front
  (l'e-mail est une constante de configuration du front, jamais en base).
- `GET /health`
- OpenAPI servi en JSON : c'est le contrat que le portage Rust devra honorer à l'identique.

## Migrations et seeds
- `db/migrations/NNNN_description.sql` écrits à la main, appliqués dans l'ordre par un runner
  minimal (table `schema_migrations`). Drizzle est utilisé pour les requêtes typées, pas pour
  générer le schéma : le schéma Drizzle est dérivé du SQL, pas l'inverse.
- `db/seeds/NNNN_contenu.sql` idempotents (`insert … on conflict (slug) do update`). Le contenu
  du CV (novembre 2026) est le premier seed ; téléphone et e-mail n'y figurent jamais.
