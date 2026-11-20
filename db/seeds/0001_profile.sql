-- Profil de Julien : une seule ligne (id = 1), traduite en fr et en.
-- Aucune donnée de contact (e-mail, téléphone) : le contact est géré par le front.

insert into profile (id, first_name, last_name, picture_path, location)
values (1, 'Julien', 'Lachaux', '/images/profile/portrait.jpg', 'Melun, Île-de-France')
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  picture_path = excluded.picture_path,
  location = excluded.location;

insert into profile_translations (
  profile_id, locale, title, picture_alt,
  title_badge, taglines, intro, mission, current_activity,
  seeking_format, seeking_location, seeking_availability, cv_path
)
values (
  1,
  'fr',
  'Développeur full-stack',
  'Portrait de Julien Lachaux',
  'senior',
  array[
    'NestJS, Vue.js — données, ETL et analytics',
    'Développement assisté par IA et agentique'
  ],
  'Depuis 2017, je conçois des API, des interfaces et des flux de données fiables. Mon fil rouge : faire circuler la donnée entre des systèmes qui ne se parlent pas.',
  'Je souhaite mettre ce savoir-faire au service de structures utiles : associations, ONG, économie sociale et solidaire, écologie, service public.',
  'Bénévole 2 jours par semaine : je développe un outil d’aide au parcours de soins en milieu psychiatrique',
  'Temps partiel (3 jours par semaine) ou missions freelance courtes',
  'Paris, Île-de-France · hybride ou à distance',
  'Immédiate',
  '/cv/cv-fr.pdf'
)
on conflict (profile_id, locale) do update set
  title = excluded.title,
  picture_alt = excluded.picture_alt,
  title_badge = excluded.title_badge,
  taglines = excluded.taglines,
  intro = excluded.intro,
  mission = excluded.mission,
  current_activity = excluded.current_activity,
  seeking_format = excluded.seeking_format,
  seeking_location = excluded.seeking_location,
  seeking_availability = excluded.seeking_availability,
  cv_path = excluded.cv_path;

insert into profile_translations (
  profile_id, locale, title, picture_alt,
  title_badge, taglines, intro, mission, current_activity,
  seeking_format, seeking_location, seeking_availability, cv_path
)
values (
  1,
  'en',
  -- EN : à relire
  'Full-stack developer',
  -- EN : à relire
  'Portrait of Julien Lachaux',
  'senior',
  array[
    -- EN : à relire
    'NestJS, Vue.js — data, ETL and analytics',
    -- EN : à relire
    'AI-assisted and agentic development'
  ],
  -- EN : à relire
  'Since 2017, I have been designing APIs, interfaces and reliable data flows. My common thread: making data flow between systems that do not talk to each other.',
  -- EN : à relire
  'I want to put this expertise at the service of useful organizations: non-profits, NGOs, the social and solidarity economy, ecology, public service.',
  -- EN : à relire
  'Volunteering two days a week: I am developing a tool that supports care pathways in psychiatric settings',
  -- EN : à relire
  'Part-time (3 days a week) or short freelance assignments',
  -- EN : à relire
  'Paris, Île-de-France · hybrid or remote',
  -- EN : à relire
  'Immediate',
  '/cv/cv-en.pdf'
)
on conflict (profile_id, locale) do update set
  title = excluded.title,
  picture_alt = excluded.picture_alt,
  title_badge = excluded.title_badge,
  taglines = excluded.taglines,
  intro = excluded.intro,
  mission = excluded.mission,
  current_activity = excluded.current_activity,
  seeking_format = excluded.seeking_format,
  seeking_location = excluded.seeking_location,
  seeking_availability = excluded.seeking_availability,
  cv_path = excluded.cv_path;
