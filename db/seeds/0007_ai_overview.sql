-- Section « IA » (BF-5, brief back-001) : une seule ligne (id = 1), textes du handoff v6 (`ai.*`, sans le
-- champ `todo` : le contenu complémentaire viendra de Julien). Étiquettes : mastra et agentic-development.
-- Aucune donnée de contact.

insert into ai_overview (id)
values (1)
on conflict (id) do update set id = excluded.id;

insert into ai_overview_translations
  (ai_overview_id, locale, title, in_product_label, in_product_items, daily_label, daily_text)
values (
  1,
  'fr',
  'L’IA, dans le produit et au quotidien',
  'dans le produit · Nopillo, 2026',
  array[
    'OCR pour les tickets de caisse et les factures',
    'Remplissage automatique des déclarations fiscales',
    'Cadrage et premiers développements d’une IA agentique de recommandation fiscale'
  ],
  'au quotidien',
  'Usage quotidien de l’IA dans ma pratique de développement, développement agentique avec Mastra, veille technique active.'
)
on conflict (ai_overview_id, locale) do update set
  title = excluded.title,
  in_product_label = excluded.in_product_label,
  in_product_items = excluded.in_product_items,
  daily_label = excluded.daily_label,
  daily_text = excluded.daily_text;

insert into ai_overview_translations
  (ai_overview_id, locale, title, in_product_label, in_product_items, daily_label, daily_text)
values (
  1,
  'en',
  -- EN : à relire
  'AI, in the product and day to day',
  -- EN : à relire
  'in the product · Nopillo, 2026',
  array[
    -- EN : à relire
    'OCR for receipts and invoices',
    -- EN : à relire
    'Automatic filling of tax returns',
    -- EN : à relire
    'Scoping and first developments of an agentic AI for tax recommendations'
  ],
  -- EN : à relire
  'day to day',
  -- EN : à relire
  'Daily use of AI in my development practice, agentic development with Mastra, active technology watch.'
)
on conflict (ai_overview_id, locale) do update set
  title = excluded.title,
  in_product_label = excluded.in_product_label,
  in_product_items = excluded.in_product_items,
  daily_label = excluded.daily_label,
  daily_text = excluded.daily_text;

insert into ai_overview_skills (ai_overview_id, skill_id, sort_order)
select 1, s.id, v.sort_order
from (values
  ('mastra', 1),
  ('agentic-development', 2)
) as v (skill_slug, sort_order)
left join skills s on s.slug = v.skill_slug -- left join : un slug inconnu viole not null au lieu d'être ignoré
on conflict (ai_overview_id, skill_id) do update set sort_order = excluded.sort_order;
