-- Groupes de compétences (7 catégories du CV, novembre 2026) et compétences.
-- Niveaux : 3 partout (point ouvert P2) ; icônes : slug devicon quand il existe, sinon slug
-- de la compétence avec icon_path null (point ouvert P3).

insert into skill_groups (slug, sort_order, published)
values
  ('languages-frameworks', 1, true),
  ('data-messaging', 2, true),
  ('integration-etl', 3, true),
  ('analytics', 4, true),
  ('applied-ai', 5, true),
  ('devops', 6, true),
  ('practices', 7, true)
on conflict (slug) do update set
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'fr',
  'Langages et frameworks',
  null
from skill_groups p
where p.slug = 'languages-frameworks'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'en',
  -- EN : à relire
  'Languages and frameworks',
  null
from skill_groups p
where p.slug = 'languages-frameworks'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'fr',
  'Données et messagerie',
  null
from skill_groups p
where p.slug = 'data-messaging'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'en',
  -- EN : à relire
  'Data and messaging',
  null
from skill_groups p
where p.slug = 'data-messaging'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'fr',
  'Intégration et ETL',
  null
from skill_groups p
where p.slug = 'integration-etl'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'en',
  -- EN : à relire
  'Integration and ETL',
  null
from skill_groups p
where p.slug = 'integration-etl'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'fr',
  'Analytics',
  null
from skill_groups p
where p.slug = 'analytics'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'en',
  'Analytics',
  null
from skill_groups p
where p.slug = 'analytics'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'fr',
  'IA appliquée',
  null
from skill_groups p
where p.slug = 'applied-ai'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'en',
  -- EN : à relire
  'Applied AI',
  null
from skill_groups p
where p.slug = 'applied-ai'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'fr',
  'DevOps',
  null
from skill_groups p
where p.slug = 'devops'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'en',
  'DevOps',
  null
from skill_groups p
where p.slug = 'devops'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'fr',
  'Pratiques',
  null
from skill_groups p
where p.slug = 'practices'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skill_groups_translations (skill_group_id, locale, name, description)
select p.id, 'en',
  -- EN : à relire
  'Practices',
  null
from skill_groups p
where p.slug = 'practices'
on conflict (skill_group_id, locale) do update set name = excluded.name, description = excluded.description;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true
from (values
  ('typescript', 'typescript', 1),
  ('javascript', 'javascript', 2),
  ('nodejs', 'nodejs', 3),
  ('nestjs', 'nestjs', 4),
  ('vuejs', 'vuejs', 5),
  ('php', 'php', 6),
  ('symfony', 'symfony', 7),
  ('elysia', 'elysia', 8),
  ('solidjs', 'solidjs', 9),
  ('html5', 'html5', 10),
  ('css', 'css3', 11)
) as v (slug, icon, sort_order)
join skill_groups g on g.slug = 'languages-frameworks'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true
from (values
  ('postgresql', 'postgresql', 1),
  ('mysql', 'mysql', 2),
  ('redis', 'redis', 3),
  ('kafka', 'apachekafka', 4),
  ('rabbitmq', 'rabbitmq', 5),
  ('mongodb', 'mongodb', 6)
) as v (slug, icon, sort_order)
join skill_groups g on g.slug = 'data-messaging'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true
from (values
  ('streamsets', 'streamsets', 1),
  ('rest-api', 'rest-api', 2),
  ('ecommerce-integrations', 'ecommerce-integrations', 3),
  ('magento', 'magento', 4)
) as v (slug, icon, sort_order)
join skill_groups g on g.slug = 'integration-etl'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true
from (values
  ('posthog', 'posthog', 1),
  ('google-analytics', 'google-analytics', 2),
  ('adobe-analytics', 'adobe-analytics', 3)
) as v (slug, icon, sort_order)
join skill_groups g on g.slug = 'analytics'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true
from (values
  ('ai-features', 'ai-features', 1),
  ('ocr', 'ocr', 2),
  ('agentic-development', 'agentic-development', 3),
  ('mastra', 'mastra', 4),
  ('ai-daily-use', 'ai-daily-use', 5)
) as v (slug, icon, sort_order)
join skill_groups g on g.slug = 'applied-ai'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true
from (values
  ('docker', 'docker', 1),
  ('managed-cloud-deployment', 'managed-cloud-deployment', 2)
) as v (slug, icon, sort_order)
join skill_groups g on g.slug = 'devops'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true
from (values
  ('agile', 'agile', 1),
  ('git', 'git', 2),
  ('production-operations', 'production-operations', 3)
) as v (slug, icon, sort_order)
join skill_groups g on g.slug = 'practices'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published;

insert into skills_translations (skill_id, locale, name)
select s.id, 'fr', v.name
from (values
  ('typescript', 'TypeScript'),
  ('javascript', 'JavaScript'),
  ('nodejs', 'Node.js'),
  ('nestjs', 'NestJS'),
  ('vuejs', 'Vue.js (2 et 3)'),
  ('php', 'PHP'),
  ('symfony', 'Symfony'),
  ('elysia', 'Elysia.js'),
  ('solidjs', 'Solid.js'),
  ('html5', 'HTML5'),
  ('css', 'CSS'),
  ('postgresql', 'PostgreSQL'),
  ('mysql', 'MySQL'),
  ('redis', 'Redis'),
  ('kafka', 'Apache Kafka'),
  ('rabbitmq', 'RabbitMQ'),
  ('mongodb', 'MongoDB'),
  ('streamsets', 'StreamSets'),
  ('rest-api', 'API REST'),
  ('ecommerce-integrations', 'Intégrations e-commerce'),
  ('magento', 'Magento'),
  ('posthog', 'PostHog'),
  ('google-analytics', 'Google Analytics'),
  ('adobe-analytics', 'Adobe Analytics'),
  ('ai-features', 'Intégration de fonctionnalités d''IA'),
  ('ocr', 'OCR'),
  ('agentic-development', 'Développement agentique'),
  ('mastra', 'Mastra'),
  ('ai-daily-use', 'Usage quotidien de l''IA en développement'),
  ('docker', 'Docker'),
  ('managed-cloud-deployment', 'Déploiement en environnement cloud managé'),
  ('agile', 'Méthodes agiles'),
  ('git', 'Git'),
  ('production-operations', 'Exploitation et diagnostic en production')
) as v (slug, name)
join skills s on s.slug = v.slug
on conflict (skill_id, locale) do update set name = excluded.name;

insert into skills_translations (skill_id, locale, name)
select s.id, 'en', v.name
from (values
  ('typescript', 'TypeScript'),
  ('javascript', 'JavaScript'),
  ('nodejs', 'Node.js'),
  ('nestjs', 'NestJS'),
  -- EN : à relire
  ('vuejs', 'Vue.js (2 and 3)'),
  ('php', 'PHP'),
  ('symfony', 'Symfony'),
  ('elysia', 'Elysia.js'),
  ('solidjs', 'Solid.js'),
  ('html5', 'HTML5'),
  ('css', 'CSS'),
  ('postgresql', 'PostgreSQL'),
  ('mysql', 'MySQL'),
  ('redis', 'Redis'),
  ('kafka', 'Apache Kafka'),
  ('rabbitmq', 'RabbitMQ'),
  ('mongodb', 'MongoDB'),
  ('streamsets', 'StreamSets'),
  -- EN : à relire
  ('rest-api', 'REST API'),
  -- EN : à relire
  ('ecommerce-integrations', 'E-commerce integrations'),
  ('magento', 'Magento'),
  ('posthog', 'PostHog'),
  ('google-analytics', 'Google Analytics'),
  ('adobe-analytics', 'Adobe Analytics'),
  -- EN : à relire
  ('ai-features', 'AI feature integration'),
  ('ocr', 'OCR'),
  -- EN : à relire
  ('agentic-development', 'Agentic development'),
  ('mastra', 'Mastra'),
  -- EN : à relire
  ('ai-daily-use', 'Daily use of AI in development'),
  ('docker', 'Docker'),
  -- EN : à relire
  ('managed-cloud-deployment', 'Deployment on managed cloud environments'),
  -- EN : à relire
  ('agile', 'Agile methods'),
  ('git', 'Git'),
  -- EN : à relire
  ('production-operations', 'Production operations and diagnosis')
) as v (slug, name)
join skills s on s.slug = v.slug
on conflict (skill_id, locale) do update set name = excluded.name;
