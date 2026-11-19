-- Groupes de compétences (7 catégories du CV, novembre 2026) et compétences.
-- Niveaux : 3 partout (point ouvert P2) ; icônes : slug devicon quand il existe, sinon slug
-- de la compétence avec icon_path null (point ouvert P3).
-- main_stack_order : rang dans la stack principale du site (BF-3), null pour les autres compétences.

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

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published, main_stack_order)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true, v.main_stack_order
from (values
  ('typescript', 'typescript', 1, 1),
  ('javascript', 'javascript', 2, null::smallint),
  ('nodejs', 'nodejs', 3, 2),
  ('nestjs', 'nestjs', 4, 3),
  ('vuejs', 'vuejs', 5, 4),
  ('php', 'php', 6, null::smallint),
  ('symfony', 'symfony', 7, null::smallint),
  ('elysia', 'elysia', 8, null::smallint),
  ('solidjs', 'solidjs', 9, null::smallint),
  ('html5', 'html5', 10, null::smallint),
  ('css', 'css3', 11, null::smallint)
) as v (slug, icon, sort_order, main_stack_order)
join skill_groups g on g.slug = 'languages-frameworks'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published,
  main_stack_order = excluded.main_stack_order;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published, main_stack_order)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true, v.main_stack_order
from (values
  ('postgresql', 'postgresql', 1, 5),
  ('mysql', 'mysql', 2, null::smallint),
  ('redis', 'redis', 3, null::smallint),
  ('kafka', 'apachekafka', 4, 6),
  ('rabbitmq', 'rabbitmq', 5, null::smallint),
  ('mongodb', 'mongodb', 6, null::smallint)
) as v (slug, icon, sort_order, main_stack_order)
join skill_groups g on g.slug = 'data-messaging'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published,
  main_stack_order = excluded.main_stack_order;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published, main_stack_order)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true, v.main_stack_order
from (values
  ('streamsets', 'streamsets', 1, null::smallint),
  ('rest-api', 'rest-api', 2, null::smallint),
  ('ecommerce-integrations', 'ecommerce-integrations', 3, null::smallint),
  ('magento', 'magento', 4, null::smallint)
) as v (slug, icon, sort_order, main_stack_order)
join skill_groups g on g.slug = 'integration-etl'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published,
  main_stack_order = excluded.main_stack_order;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published, main_stack_order)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true, v.main_stack_order
from (values
  ('posthog', 'posthog', 1, null::smallint),
  ('google-analytics', 'google-analytics', 2, null::smallint),
  ('adobe-analytics', 'adobe-analytics', 3, null::smallint)
) as v (slug, icon, sort_order, main_stack_order)
join skill_groups g on g.slug = 'analytics'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published,
  main_stack_order = excluded.main_stack_order;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published, main_stack_order)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true, v.main_stack_order
from (values
  ('ai-features', 'ai-features', 1, null::smallint),
  ('ocr', 'ocr', 2, null::smallint),
  ('agentic-development', 'agentic-development', 3, null::smallint),
  ('mastra', 'mastra', 4, null::smallint),
  ('ai-daily-use', 'ai-daily-use', 5, null::smallint)
) as v (slug, icon, sort_order, main_stack_order)
join skill_groups g on g.slug = 'applied-ai'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published,
  main_stack_order = excluded.main_stack_order;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published, main_stack_order)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true, v.main_stack_order
from (values
  ('docker', 'docker', 1, 7),
  ('managed-cloud-deployment', 'managed-cloud-deployment', 2, null::smallint)
) as v (slug, icon, sort_order, main_stack_order)
join skill_groups g on g.slug = 'devops'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published,
  main_stack_order = excluded.main_stack_order;

insert into skills (slug, group_id, level, icon, icon_path, sort_order, published, main_stack_order)
select v.slug, g.id, 3, v.icon, null, v.sort_order, true, v.main_stack_order
from (values
  ('agile', 'agile', 1, null::smallint),
  ('git', 'git', 2, null::smallint),
  ('production-operations', 'production-operations', 3, null::smallint)
) as v (slug, icon, sort_order, main_stack_order)
join skill_groups g on g.slug = 'practices'
on conflict (slug) do update set
  group_id = excluded.group_id,
  level = excluded.level,
  icon = excluded.icon,
  icon_path = excluded.icon_path,
  sort_order = excluded.sort_order,
  published = excluded.published,
  main_stack_order = excluded.main_stack_order;

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
  ('managed-cloud-deployment', 'Cloud managé'),
  ('agile', 'Méthodes agiles'),
  ('git', 'Git'),
  ('production-operations', 'Diagnostic en production')
) as v (slug, name)
left join skills s on s.slug = v.slug -- left join : un slug inconnu viole not null au lieu d'être ignoré
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
  ('managed-cloud-deployment', 'Managed cloud'),
  -- EN : à relire
  ('agile', 'Agile methods'),
  ('git', 'Git'),
  -- EN : à relire
  ('production-operations', 'Production diagnosis')
) as v (slug, name)
left join skills s on s.slug = v.slug -- left join : un slug inconnu viole not null au lieu d'être ignoré
on conflict (skill_id, locale) do update set name = excluded.name;
