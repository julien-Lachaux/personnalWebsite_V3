-- Expériences professionnelles (la pause rentre dans kind = 'break') et leurs compétences.

create table experiences (
  id integer generated always as identity primary key,
  slug text not null unique,
  kind experience_kind not null,
  -- Null pour une pause : pas d'employeur.
  company text,
  company_url text,
  logo_path text,
  contract_type contract_type,
  work_mode work_mode,
  -- Premier jour du mois.
  date_start date not null,
  -- Null = en cours.
  date_end date,
  sort_order integer not null default 0,
  published boolean not null default true,
  constraint experiences_dates_check check (date_end is null or date_end >= date_start),
  constraint experiences_break_company_check check (kind <> 'break' or company is null)
);

create index experiences_published_date_start_idx on experiences (published, date_start desc);

create table experiences_translations (
  experience_id integer not null references experiences (id) on delete cascade,
  locale locale_code not null,
  job_title text not null,
  location text,
  summary text not null,
  -- Une réalisation par élément, texte brut.
  achievements text[] not null default '{}',
  logo_alt text,
  stack_label text,
  primary key (experience_id, locale)
);

create table experience_skills (
  experience_id integer not null references experiences (id) on delete cascade,
  skill_id integer not null references skills (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (experience_id, skill_id)
);

create index experience_skills_skill_id_idx on experience_skills (skill_id);
