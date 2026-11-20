-- BF-5 (brief back-001) : section « IA » du site, une seule ligne (id = 1) traduite par locale, comme le
-- profil. Ses étiquettes (compétences) sont dans ai_overview_skills, ordonnées par sort_order.

create table ai_overview (
  id smallint primary key check (id = 1),
  deleted_at timestamptz
);

create table ai_overview_translations (
  ai_overview_id smallint not null references ai_overview (id) on delete cascade,
  locale locale_code not null,
  title text not null check (title <> ''),
  in_product_label text not null check (in_product_label <> ''),
  -- Un point par élément, texte brut : au moins un, aucun vide ni nul.
  in_product_items text[] not null,
  daily_label text not null check (daily_label <> ''),
  daily_text text not null check (daily_text <> ''),
  primary key (ai_overview_id, locale),
  constraint ai_overview_translations_in_product_items_check check (
    cardinality(in_product_items) >= 1
    and array_position(in_product_items, '') is null
    and array_position(in_product_items, null::text) is null
  )
);

create table ai_overview_skills (
  ai_overview_id smallint not null references ai_overview (id) on delete cascade,
  skill_id integer not null references skills (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (ai_overview_id, skill_id)
);

create index ai_overview_skills_skill_id_idx on ai_overview_skills (skill_id);
