-- BF-4 (brief back-001) : recommandations professionnelles (citations), ordonnées par sort_order.
-- `author_name` et `recommended_on` sont communs aux langues ; le rôle de l'auteur, la relation avec
-- Julien et la citation (un paragraphe par élément) sont traduits. Les citations ne sont pas toutes
-- traduites : sans ligne `en`, l'API sert la ligne `fr` entière (repli de langue par ligne).

create table recommendations (
  id integer generated always as identity primary key,
  slug text not null unique,
  author_name text not null check (author_name <> ''),
  recommended_on date not null,
  sort_order integer not null default 0,
  published boolean not null default true,
  deleted_at timestamptz
);

create index recommendations_published_sort_order_idx on recommendations (published, sort_order);

create table recommendations_translations (
  recommendation_id integer not null references recommendations (id) on delete cascade,
  locale locale_code not null,
  author_role text not null check (author_role <> ''),
  relationship text not null check (relationship <> ''),
  -- Un paragraphe par élément, texte brut : au moins un, aucun vide ni nul.
  paragraphs text[] not null,
  primary key (recommendation_id, locale),
  constraint recommendations_translations_paragraphs_check check (
    cardinality(paragraphs) >= 1
    and array_position(paragraphs, '') is null
    and array_position(paragraphs, null::text) is null
  )
);
