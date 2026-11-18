-- Liens sociaux (github, linkedin, website…), ordonnés par sort_order.

create table social_links (
  id integer generated always as identity primary key,
  slug text not null unique,
  kind text not null,
  url text not null,
  sort_order integer not null default 0,
  published boolean not null default true
);

create index social_links_published_sort_order_idx on social_links (published, sort_order);

create table social_links_translations (
  social_link_id integer not null references social_links (id) on delete cascade,
  locale locale_code not null,
  label text not null,
  primary key (social_link_id, locale)
);
