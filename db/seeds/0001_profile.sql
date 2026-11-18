-- Profil de Julien : une seule ligne (id = 1), traduite en fr et en.
-- Aucune donnée de contact (e-mail, téléphone) : le contact est géré par le front.

insert into profile (id, first_name, last_name, picture_path, location)
values (1, 'Julien', 'Lachaux', '/images/profile/portrait.jpg', 'Melun, Île-de-France')
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  picture_path = excluded.picture_path,
  location = excluded.location;

insert into profile_translations (profile_id, locale, title, headline, bio, availability, picture_alt)
values (
  1,
  'fr',
  'Développeur full-stack TypeScript senior',
  'NestJS, Vue.js — données, ETL et analytics — IA agentique et IA au quotidien',
  'Développeur full-stack depuis 2017, je conçois des API, des interfaces et des flux de données fiables, principalement en TypeScript. Mon fil rouge : faire circuler la donnée entre des systèmes qui ne se parlent pas, de l''ETL aux intégrations d''outils d''analytics.

Autonome du cadrage à la production, je souhaite mettre ce savoir-faire au service de structures utiles : associations, ONG, économie sociale et solidaire, écologie, service public.',
  'Disponible pour des missions',
  'Portrait de Julien Lachaux'
)
on conflict (profile_id, locale) do update set title = excluded.title, headline = excluded.headline, bio = excluded.bio, availability = excluded.availability, picture_alt = excluded.picture_alt;

insert into profile_translations (profile_id, locale, title, headline, bio, availability, picture_alt)
values (
  1,
  'en',
  -- EN : à relire
  'Senior full-stack TypeScript developer',
  -- EN : à relire
  'NestJS, Vue.js — data, ETL and analytics — agentic AI and everyday AI',
  -- EN : à relire
  'Full-stack developer since 2017, I design APIs, interfaces and reliable data flows, mainly in TypeScript. My common thread: making data flow between systems that do not talk to each other, from ETL to analytics tool integrations.

Autonomous from scoping to production, I want to put this expertise at the service of useful organizations: non-profits, NGOs, the social and solidarity economy, ecology, public service.',
  -- EN : à relire
  'Available for missions',
  -- EN : à relire
  'Portrait of Julien Lachaux'
)
on conflict (profile_id, locale) do update set title = excluded.title, headline = excluded.headline, bio = excluded.bio, availability = excluded.availability, picture_alt = excluded.picture_alt;
