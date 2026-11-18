-- Groupes de compétences et compétences. Aucune couleur ni décoration : seul sort_order ordonne.

create table skill_groups (
  id integer generated always as identity primary key,
  slug text not null unique,
  sort_order integer not null default 0,
  published boolean not null default true
);

create index skill_groups_published_sort_order_idx on skill_groups (published, sort_order);

create table skill_groups_translations (
  skill_group_id integer not null references skill_groups (id) on delete cascade,
  locale locale_code not null,
  name text not null,
  description text,
  primary key (skill_group_id, locale)
);

create table skills (
  id integer generated always as identity primary key,
  slug text not null unique,
  group_id integer not null references skill_groups (id) on delete restrict,
  level smallint not null check (level between 1 and 5),
  -- Slug devicon, ou slug générique quand aucune icône devicon n'existe.
  icon text not null,
  -- Chemin d'un SVG maison servi par le front (`/images/...`), sinon null.
  icon_path text,
  sort_order integer not null default 0,
  published boolean not null default true
);

create index skills_group_published_sort_order_idx on skills (group_id, published, sort_order);

create table skills_translations (
  skill_id integer not null references skills (id) on delete cascade,
  locale locale_code not null,
  name text not null,
  primary key (skill_id, locale)
);
