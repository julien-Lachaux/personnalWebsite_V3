-- Certifications, formation (3 lignes, point ouvert P6) et langues du CV (novembre 2026).
-- projects, tools et resources : aucun seed (point ouvert P5), l'API renvoie des listes vides.

insert into certifications (slug, issuer, year, url, sort_order, published)
values
  ('contentsquare-certified', 'Contentsquare', 2021, null, 1, true),
  ('ef-set-plus-62', 'EF SET', 2015, null, 2, true),
  ('openclassrooms-integrateur-web', 'OpenClassrooms', 2015, null, 3, true)
on conflict (slug) do update set
  issuer = excluded.issuer,
  year = excluded.year,
  url = excluded.url,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into certifications_translations (certification_id, locale, name)
select p.id, 'fr',
  'Contentsquare Certified'
from certifications p
where p.slug = 'contentsquare-certified'
on conflict (certification_id, locale) do update set name = excluded.name;

insert into certifications_translations (certification_id, locale, name)
select p.id, 'en',
  'Contentsquare Certified'
from certifications p
where p.slug = 'contentsquare-certified'
on conflict (certification_id, locale) do update set name = excluded.name;

insert into certifications_translations (certification_id, locale, name)
select p.id, 'fr',
  'EF SET Plus 62, anglais C1'
from certifications p
where p.slug = 'ef-set-plus-62'
on conflict (certification_id, locale) do update set name = excluded.name;

insert into certifications_translations (certification_id, locale, name)
select p.id, 'en',
  -- EN : à relire
  'EF SET Plus 62, English C1'
from certifications p
where p.slug = 'ef-set-plus-62'
on conflict (certification_id, locale) do update set name = excluded.name;

insert into certifications_translations (certification_id, locale, name)
select p.id, 'fr',
  'Intégrateur Web'
from certifications p
where p.slug = 'openclassrooms-integrateur-web'
on conflict (certification_id, locale) do update set name = excluded.name;

insert into certifications_translations (certification_id, locale, name)
select p.id, 'en',
  -- EN : à relire
  'Web Integrator'
from certifications p
where p.slug = 'openclassrooms-integrateur-web'
on conflict (certification_id, locale) do update set name = excluded.name;

insert into education (slug, institution, year_start, year_end, url, sort_order, published)
values
  ('eemi', 'EEMI', 2016, 2016, null, 1, true),
  ('openclassrooms-integrateur-web', 'OpenClassrooms', 2015, 2015, null, 2, true),
  ('autodidacte', 'Autodidacte', 2015, null, null, 3, true)
on conflict (slug) do update set
  institution = excluded.institution,
  year_start = excluded.year_start,
  year_end = excluded.year_end,
  url = excluded.url,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into education_translations (education_id, locale, title, description)
select p.id, 'fr',
  'Formation à l''EEMI',
  'Quelques mois de formation en 2016.'
from education p
where p.slug = 'eemi'
on conflict (education_id, locale) do update set title = excluded.title, description = excluded.description;

insert into education_translations (education_id, locale, title, description)
select p.id, 'en',
  -- EN : à relire
  'Studies at EEMI',
  -- EN : à relire
  'A few months of training in 2016.'
from education p
where p.slug = 'eemi'
on conflict (education_id, locale) do update set title = excluded.title, description = excluded.description;

insert into education_translations (education_id, locale, title, description)
select p.id, 'fr',
  'Parcours Intégrateur Web',
  null
from education p
where p.slug = 'openclassrooms-integrateur-web'
on conflict (education_id, locale) do update set title = excluded.title, description = excluded.description;

insert into education_translations (education_id, locale, title, description)
select p.id, 'en',
  -- EN : à relire
  'Web Integrator track',
  null
from education p
where p.slug = 'openclassrooms-integrateur-web'
on conflict (education_id, locale) do update set title = excluded.title, description = excluded.description;

insert into education_translations (education_id, locale, title, description)
select p.id, 'fr',
  'Formation autodidacte',
  'Formation autodidacte au développement web, complétée par des cursus encadrés.'
from education p
where p.slug = 'autodidacte'
on conflict (education_id, locale) do update set title = excluded.title, description = excluded.description;

insert into education_translations (education_id, locale, title, description)
select p.id, 'en',
  -- EN : à relire
  'Self-taught training',
  -- EN : à relire
  'Self-taught web development, complemented by guided courses.'
from education p
where p.slug = 'autodidacte'
on conflict (education_id, locale) do update set title = excluded.title, description = excluded.description;

insert into languages (slug, code, cefr_level, sort_order, published)
values
  ('french', 'fr', null, 1, true),
  ('english', 'en', 'C1', 2, true)
on conflict (slug) do update set
  code = excluded.code,
  cefr_level = excluded.cefr_level,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into languages_translations (language_id, locale, name, level_label)
select p.id, 'fr',
  'Français',
  'langue maternelle'
from languages p
where p.slug = 'french'
on conflict (language_id, locale) do update set name = excluded.name, level_label = excluded.level_label;

insert into languages_translations (language_id, locale, name, level_label)
select p.id, 'en',
  -- EN : à relire
  'French',
  -- EN : à relire
  'native language'
from languages p
where p.slug = 'french'
on conflict (language_id, locale) do update set name = excluded.name, level_label = excluded.level_label;

insert into languages_translations (language_id, locale, name, level_label)
select p.id, 'fr',
  'Anglais',
  'professionnel'
from languages p
where p.slug = 'english'
on conflict (language_id, locale) do update set name = excluded.name, level_label = excluded.level_label;

insert into languages_translations (language_id, locale, name, level_label)
select p.id, 'en',
  -- EN : à relire
  'English',
  -- EN : à relire
  'professional'
from languages p
where p.slug = 'english'
on conflict (language_id, locale) do update set name = excluded.name, level_label = excluded.level_label;
