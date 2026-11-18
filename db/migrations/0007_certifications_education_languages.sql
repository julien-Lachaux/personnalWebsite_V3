-- Certifications, formation et langues.

create table certifications (
  id integer generated always as identity primary key,
  slug text not null unique,
  issuer text not null,
  year smallint not null check (year between 1990 and 2100),
  url text,
  sort_order integer not null default 0,
  published boolean not null default true
);

create index certifications_published_sort_order_idx on certifications (published, sort_order);

create table certifications_translations (
  certification_id integer not null references certifications (id) on delete cascade,
  locale locale_code not null,
  name text not null,
  primary key (certification_id, locale)
);

create table education (
  id integer generated always as identity primary key,
  slug text not null unique,
  institution text not null,
  year_start smallint not null,
  year_end smallint,
  url text,
  sort_order integer not null default 0,
  published boolean not null default true,
  constraint education_years_check check (year_end is null or year_end >= year_start)
);

create index education_published_sort_order_idx on education (published, sort_order);

create table education_translations (
  education_id integer not null references education (id) on delete cascade,
  locale locale_code not null,
  title text not null,
  description text,
  primary key (education_id, locale)
);

create table languages (
  id integer generated always as identity primary key,
  slug text not null unique,
  code text not null unique check (code ~ '^[a-z]{2}$'),
  cefr_level text check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  sort_order integer not null default 0,
  published boolean not null default true
);

create index languages_published_sort_order_idx on languages (published, sort_order);

create table languages_translations (
  language_id integer not null references languages (id) on delete cascade,
  locale locale_code not null,
  name text not null,
  level_label text not null,
  primary key (language_id, locale)
);
