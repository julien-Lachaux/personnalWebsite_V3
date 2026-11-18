-- Profil : une seule ligne (id = 1), traduite par locale.
-- Aucune donnée de contact (e-mail, téléphone) : le contact est géré par le front.

create table profile (
  id smallint primary key check (id = 1),
  first_name text not null,
  last_name text not null,
  picture_path text not null,
  location text not null
);

create table profile_translations (
  profile_id smallint not null references profile (id) on delete cascade,
  locale locale_code not null,
  title text not null,
  headline text not null,
  bio text not null,
  availability text not null,
  picture_alt text not null,
  primary key (profile_id, locale)
);
