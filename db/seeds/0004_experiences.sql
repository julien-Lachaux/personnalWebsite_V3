-- Les 8 entrées du CV (novembre 2026), de la plus récente à la plus ancienne.
-- Dates au premier jour du mois ; la pause professionnelle est une expérience kind = 'break'
-- (sans employeur ni contrat). Logos : /images/logos/<slug>.svg fournis par le front (point ouvert P4).

insert into experiences
  (slug, kind, company, company_url, logo_path, contract_type, work_mode, date_start, date_end, sort_order, published)
values
  ('nopillo', 'employment', 'Nopillo', null, '/images/logos/nopillo.svg', 'cdi', 'hybrid', '2026-01-01', '2026-05-01', 1, true),
  ('pause-professionnelle', 'break', null, null, null, null, null, '2024-04-01', '2025-12-01', 2, true),
  ('contentsquare', 'employment', 'Contentsquare', null, '/images/logos/contentsquare.svg', 'cdi', 'hybrid', '2021-03-01', '2024-03-01', 3, true),
  ('wynd-integration', 'employment', 'Wynd', null, '/images/logos/wynd-integration.svg', 'cdi', 'hybrid', '2020-07-01', '2021-02-01', 4, true),
  ('wynd-etl', 'employment', 'Wynd', null, '/images/logos/wynd-etl.svg', 'cdi', 'hybrid', '2019-03-01', '2020-07-01', 5, true),
  ('leboncoin', 'freelance', 'leboncoin', null, '/images/logos/leboncoin.svg', 'freelance', 'hybrid', '2018-10-01', '2018-11-01', 6, true),
  ('afluens', 'employment', 'Afluens', null, '/images/logos/afluens.svg', 'cdi', 'hybrid', '2017-08-01', '2018-06-01', 7, true),
  ('openclassrooms-mentor', 'mentoring', 'OpenClassrooms', null, '/images/logos/openclassrooms-mentor.svg', 'none', 'remote', '2015-05-01', '2015-11-01', 8, true)
on conflict (slug) do update set
  kind = excluded.kind,
  company = excluded.company,
  company_url = excluded.company_url,
  logo_path = excluded.logo_path,
  contract_type = excluded.contract_type,
  work_mode = excluded.work_mode,
  date_start = excluded.date_start,
  date_end = excluded.date_end,
  sort_order = excluded.sort_order,
  published = excluded.published;

-- nopillo
insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'fr',
  'Senior Software Engineer',
  'Paris',
  'Intégration de fonctionnalités d''IA dans le produit.',
  array[
    'Développement d''un système d''OCR pour les tickets de caisse et les factures',
    'Développement du remplissage automatique des déclarations fiscales',
    'Participation au cadrage et aux premiers développements d''une IA agentique de recommandation fiscale',
    'Participation au développement des bases du projet en full-stack (front et back, principalement back-end)'
  ],
  'Logo de Nopillo',
  'TypeScript, Elysia.js, Solid.js, Mastra, PostHog, Docker'
from experiences p
where p.slug = 'nopillo'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'en',
  'Senior Software Engineer',
  'Paris',
  -- EN : à relire
  'Integration of AI features into the product.',
  array[
    -- EN : à relire
    'Development of an OCR system for receipts and invoices',
    -- EN : à relire
    'Development of automatic filling of tax returns',
    -- EN : à relire
    'Contribution to the scoping and first developments of an agentic AI for tax recommendations',
    -- EN : à relire
    'Contribution to building the project foundations in full-stack (front end and back end, mostly back end)'
  ],
  -- EN : à relire
  'Nopillo logo',
  'TypeScript, Elysia.js, Solid.js, Mastra, PostHog, Docker'
from experiences p
where p.slug = 'nopillo'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

-- pause-professionnelle
insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'fr',
  'Pause professionnelle',
  null,
  'Pause consacrée à un projet immobilier personnel. En parallèle, veille technique active, avec un usage quotidien de l''IA dans ma pratique de développement.',
  '{}'::text[],
  null,
  'Huile de coude'
from experiences p
where p.slug = 'pause-professionnelle'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'en',
  -- EN : à relire
  'Career break',
  null,
  -- EN : à relire
  'Break devoted to a personal real estate project. Alongside it, active technology watch, with daily use of AI in my development practice.',
  '{}'::text[],
  null,
  -- EN : à relire
  'Elbow grease'
from experiences p
where p.slug = 'pause-professionnelle'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

-- contentsquare
insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'fr',
  'Software Engineer',
  'Paris',
  'Analyse des écarts de collecte de données entre outils d''analytics, puis développement full-stack dans l''équipe Intégrations.',
  array[
    'Pendant deux ans, analyse et diagnostic des écarts de collecte de données entre outils d''analytics (Contentsquare, Google Analytics, Adobe Analytics)',
    'Conception d''outils internes pour faciliter ce diagnostic au support technique',
    'Puis développeur full-stack dans l''équipe Intégrations : back-end TypeScript (NestJS, Kafka, Redis, PostgreSQL), front-end Vue 2 et Vue 3'
  ],
  'Logo de Contentsquare',
  'TypeScript, NestJS, Vue.js, PostgreSQL, Kafka, Redis, Docker'
from experiences p
where p.slug = 'contentsquare'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'en',
  'Software Engineer',
  'Paris',
  -- EN : à relire
  'Analysis of data collection discrepancies between analytics tools, then full-stack development in the Integrations team.',
  array[
    -- EN : à relire
    'For two years, analysis and diagnosis of data collection discrepancies between analytics tools (Contentsquare, Google Analytics, Adobe Analytics)',
    -- EN : à relire
    'Design of internal tools to help technical support run this diagnosis',
    -- EN : à relire
    'Then full-stack developer in the Integrations team: TypeScript back end (NestJS, Kafka, Redis, PostgreSQL), Vue 2 and Vue 3 front end'
  ],
  -- EN : à relire
  'Contentsquare logo',
  'TypeScript, NestJS, Vue.js, PostgreSQL, Kafka, Redis, Docker'
from experiences p
where p.slug = 'contentsquare'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

-- wynd-integration
insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'fr',
  'Expert Intégration SI & Flux',
  'Paris',
  'Équipe RUN, en charge de la production et de la maintenance applicative.',
  array[
    'Cadrage et réalisation de chantiers d''intégration du produit : API, front e-commerce (Magento), flux ETL avec le SI des clients',
    'Diagnostic et correction de bugs en production sur toute la stack',
    'Référent StreamSets pour l''entreprise'
  ],
  'Logo de Wynd',
  'PHP (Symfony), StreamSets, RabbitMQ, MySQL, Magento, Docker'
from experiences p
where p.slug = 'wynd-integration'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'en',
  -- EN : à relire
  'Systems Integration and Data Flow Expert',
  'Paris',
  -- EN : à relire
  'RUN team, in charge of production and application maintenance.',
  array[
    -- EN : à relire
    'Scoping and delivery of product integration projects: APIs, e-commerce front end (Magento), ETL flows with customers'' information systems',
    -- EN : à relire
    'Diagnosis and fixing of production bugs across the whole stack',
    -- EN : à relire
    'Company reference for StreamSets'
  ],
  -- EN : à relire
  'Wynd logo',
  'PHP (Symfony), StreamSets, RabbitMQ, MySQL, Magento, Docker'
from experiences p
where p.slug = 'wynd-integration'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

-- wynd-etl
insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'fr',
  'Head of Chapter ETL',
  'Paris',
  'Responsable de StreamSets, l''ETL open source utilisé par l''entreprise.',
  array[
    'Définition et diffusion des bonnes pratiques',
    'Accompagnement des équipes sur la conception, le déploiement et l''amélioration des flux d''intégration, pour le produit comme pour les projets clients',
    'Industrialisation de l''usage de StreamSets dans l''entreprise'
  ],
  'Logo de Wynd',
  'StreamSets, Apache Kafka, RabbitMQ, MySQL, Docker'
from experiences p
where p.slug = 'wynd-etl'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'en',
  'Head of Chapter ETL',
  'Paris',
  -- EN : à relire
  'In charge of StreamSets, the open source ETL used by the company.',
  array[
    -- EN : à relire
    'Defining and spreading best practices',
    -- EN : à relire
    'Coaching teams on the design, deployment and improvement of integration flows, for the product as well as for customer projects',
    -- EN : à relire
    'Industrialization of StreamSets use across the company'
  ],
  -- EN : à relire
  'Wynd logo',
  'StreamSets, Apache Kafka, RabbitMQ, MySQL, Docker'
from experiences p
where p.slug = 'wynd-etl'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

-- leboncoin
insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'fr',
  'Développeur web freelance',
  'Paris',
  'Mission back-end en PHP 7 : nouvelles fonctionnalités pour le back-office et le CRM.',
  '{}'::text[],
  'Logo de leboncoin',
  'PHP 7, JavaScript'
from experiences p
where p.slug = 'leboncoin'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'en',
  -- EN : à relire
  'Freelance web developer',
  'Paris',
  -- EN : à relire
  'Back-end assignment in PHP 7: new features for the back office and the CRM.',
  '{}'::text[],
  -- EN : à relire
  'leboncoin logo',
  'PHP 7, JavaScript'
from experiences p
where p.slug = 'leboncoin'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

-- afluens
insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'fr',
  'Développeur full-stack',
  'Saint-Cloud',
  'Développement de l''outil collaboratif de l''entreprise, de la conception à la production.',
  array[
    'Nouvelles fonctionnalités et nouveaux écrans, connexions avec des API externes (ERP, routeur e-mail et SMS), exports Excel',
    'Refactoring en PHP orienté objet ; monitoring et optimisation du système de fichiers cloud (Node.js)',
    'Exploitation : maintien du service, administration du serveur, gestion des incidents, support de niveau 2'
  ],
  'Logo de Afluens',
  'PHP, JavaScript, Node.js, MongoDB, HTML5, CSS'
from experiences p
where p.slug = 'afluens'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'en',
  -- EN : à relire
  'Full-stack developer',
  'Saint-Cloud',
  -- EN : à relire
  'Development of the company''s collaborative tool, from design to production.',
  array[
    -- EN : à relire
    'New features and screens, connections with external APIs (ERP, e-mail and SMS router), Excel exports',
    -- EN : à relire
    'Refactoring to object-oriented PHP; monitoring and optimization of the cloud file system (Node.js)',
    -- EN : à relire
    'Operations: keeping the service running, server administration, incident management, level 2 support'
  ],
  -- EN : à relire
  'Afluens logo',
  'PHP, JavaScript, Node.js, MongoDB, HTML5, CSS'
from experiences p
where p.slug = 'afluens'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

-- openclassrooms-mentor
insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'fr',
  'Mentor en développement web',
  'À distance',
  'Mentorat d''étudiants en développement web, avec cours individuels en visioconférence.',
  '{}'::text[],
  'Logo de OpenClassrooms',
  'PHP, JavaScript, HTML5, CSS'
from experiences p
where p.slug = 'openclassrooms-mentor'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

insert into experiences_translations (experience_id, locale, job_title, location, summary, achievements, logo_alt, stack_label)
select p.id, 'en',
  -- EN : à relire
  'Web development mentor',
  -- EN : à relire
  'Remote',
  -- EN : à relire
  'Mentoring web development students, with one-to-one video lessons.',
  '{}'::text[],
  -- EN : à relire
  'OpenClassrooms logo',
  'PHP, JavaScript, HTML5, CSS'
from experiences p
where p.slug = 'openclassrooms-mentor'
on conflict (experience_id, locale) do update set job_title = excluded.job_title, location = excluded.location, summary = excluded.summary, achievements = excluded.achievements, logo_alt = excluded.logo_alt, stack_label = excluded.stack_label;

-- Compétences liées à chaque expérience (stack), dans l'ordre de la stack du CV.
insert into experience_skills (experience_id, skill_id, sort_order)
select e.id, s.id, v.sort_order
from (values
  ('nopillo', 'typescript', 1),
  ('nopillo', 'elysia', 2),
  ('nopillo', 'solidjs', 3),
  ('nopillo', 'mastra', 4),
  ('nopillo', 'posthog', 5),
  ('nopillo', 'docker', 6),
  ('contentsquare', 'typescript', 1),
  ('contentsquare', 'nestjs', 2),
  ('contentsquare', 'vuejs', 3),
  ('contentsquare', 'postgresql', 4),
  ('contentsquare', 'kafka', 5),
  ('contentsquare', 'redis', 6),
  ('contentsquare', 'docker', 7),
  ('wynd-integration', 'php', 1),
  ('wynd-integration', 'symfony', 2),
  ('wynd-integration', 'streamsets', 3),
  ('wynd-integration', 'rabbitmq', 4),
  ('wynd-integration', 'mysql', 5),
  ('wynd-integration', 'magento', 6),
  ('wynd-integration', 'docker', 7),
  ('wynd-etl', 'streamsets', 1),
  ('wynd-etl', 'kafka', 2),
  ('wynd-etl', 'rabbitmq', 3),
  ('wynd-etl', 'mysql', 4),
  ('wynd-etl', 'docker', 5),
  ('leboncoin', 'php', 1),
  ('leboncoin', 'javascript', 2),
  ('afluens', 'php', 1),
  ('afluens', 'javascript', 2),
  ('afluens', 'nodejs', 3),
  ('afluens', 'mongodb', 4),
  ('afluens', 'html5', 5),
  ('afluens', 'css', 6),
  ('openclassrooms-mentor', 'php', 1),
  ('openclassrooms-mentor', 'javascript', 2),
  ('openclassrooms-mentor', 'html5', 3),
  ('openclassrooms-mentor', 'css', 4)
) as v (experience_slug, skill_slug, sort_order)
left join experiences e on e.slug = v.experience_slug -- left join : un slug inconnu viole not null au lieu d'être ignoré
left join skills s on s.slug = v.skill_slug
on conflict (experience_id, skill_id) do update set sort_order = excluded.sort_order;
