-- Réalisations, outils et ressources. Images : chemins relatifs vers des fichiers statiques du front.

create table projects (
  id integer generated always as identity primary key,
  slug text not null unique,
  url text,
  repo_url text,
  image_desktop_path text,
  image_mobile_path text,
  year smallint,
  sort_order integer not null default 0,
  published boolean not null default true
);

create index projects_published_sort_order_idx on projects (published, sort_order);

create table projects_translations (
  project_id integer not null references projects (id) on delete cascade,
  locale locale_code not null,
  title text not null,
  description text not null,
  image_alt text,
  primary key (project_id, locale)
);

create table project_skills (
  project_id integer not null references projects (id) on delete cascade,
  skill_id integer not null references skills (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (project_id, skill_id)
);

create index project_skills_skill_id_idx on project_skills (skill_id);

create table tools (
  id integer generated always as identity primary key,
  slug text not null unique,
  url text,
  icon_path text,
  sort_order integer not null default 0,
  published boolean not null default true
);

create index tools_published_sort_order_idx on tools (published, sort_order);

create table tools_translations (
  tool_id integer not null references tools (id) on delete cascade,
  locale locale_code not null,
  name text not null,
  family text not null,
  description text not null,
  primary key (tool_id, locale)
);

create table resources (
  id integer generated always as identity primary key,
  slug text not null unique,
  url text not null,
  group_id integer references skill_groups (id) on delete set null,
  picture_path text,
  sort_order integer not null default 0,
  published boolean not null default true
);

create index resources_published_sort_order_idx on resources (published, sort_order);

create index resources_group_id_idx on resources (group_id);

create table resources_translations (
  resource_id integer not null references resources (id) on delete cascade,
  locale locale_code not null,
  name text not null,
  description text not null,
  picture_alt text,
  primary key (resource_id, locale)
);
