-- Liens sociaux. Seul LinkedIn est connu (point ouvert P1 : github et website non fournis).
-- Jamais d'e-mail ni de téléphone : le contact est géré par le front.

insert into social_links (slug, kind, url, sort_order, published)
values
  ('linkedin', 'linkedin', 'https://www.linkedin.com/in/julien-lachaux', 1, true),
  -- BF-6 : page des recommandations publiées sur LinkedIn (profile.links.linkedinRecommendations du handoff).
  ('linkedin-recommendations', 'linkedin', 'https://www.linkedin.com/in/julien-lachaux/details/recommendations/', 2, true)
on conflict (slug) do update set
  kind = excluded.kind,
  url = excluded.url,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into social_links_translations (social_link_id, locale, label)
select p.id, 'fr',
  'LinkedIn'
from social_links p
where p.slug = 'linkedin'
on conflict (social_link_id, locale) do update set label = excluded.label;

insert into social_links_translations (social_link_id, locale, label)
select p.id, 'en',
  'LinkedIn'
from social_links p
where p.slug = 'linkedin'
on conflict (social_link_id, locale) do update set label = excluded.label;

insert into social_links_translations (social_link_id, locale, label)
select p.id, 'fr',
  'Recommandations publiées sur LinkedIn'
from social_links p
where p.slug = 'linkedin-recommendations'
on conflict (social_link_id, locale) do update set label = excluded.label;

insert into social_links_translations (social_link_id, locale, label)
select p.id, 'en',
  -- EN : à relire
  'Recommendations published on LinkedIn'
from social_links p
where p.slug = 'linkedin-recommendations'
on conflict (social_link_id, locale) do update set label = excluded.label;
