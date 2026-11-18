-- Types partagés : enums métier et domaine de locale (docs/01).

create type experience_kind as enum ('employment', 'freelance', 'break', 'mentoring');

create type contract_type as enum ('cdi', 'freelance', 'none');

create type work_mode as enum ('onsite', 'hybrid', 'remote');

-- Locale d'une traduction : `fr` obligatoire, `en` optionnelle (repli sur `fr` côté API).
create domain locale_code as text
  constraint locale_code_check check (value in ('fr', 'en'));
