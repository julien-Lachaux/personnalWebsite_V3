-- Recommandations professionnelles (BF-4, brief back-001) : les trois citations du handoff v6, dans
-- l'ordre d'affichage, textes repris à l'identique (coquilles comprises).
-- Traduction `fr` seulement : les citations ne sont pas traduites, l'API sert la ligne `fr` entière en
-- `?lang=en` (repli de langue par ligne) et expose la langue réellement servie (`locale`).
-- published = true : écart au brief (qui demandait false tant que les auteurs n'avaient pas donné leur
-- accord). Décision de Julien le 19 novembre 2026 : ces recommandations sont déjà publiques sur
-- LinkedIn, aucun accord n'est nécessaire.

insert into recommendations (slug, author_name, recommended_on, sort_order, published)
values
  ('alexis-coudeyras', 'Alexis Coudeyras', '2025-12-08', 1, true),
  ('steeve-chevry', 'Steeve Chevry', '2020-11-04', 2, true),
  ('eric-bisceglia', 'Eric Bisceglia', '2020-09-25', 3, true)
on conflict (slug) do update set
  author_name = excluded.author_name,
  recommended_on = excluded.recommended_on,
  sort_order = excluded.sort_order,
  published = excluded.published;

-- alexis-coudeyras
insert into recommendations_translations (recommendation_id, locale, author_role, relationship, paragraphs)
select p.id, 'fr',
  'CTO',
  'Responsable direct de Julien',
  array[
    'Julien a été recruté chez Contentsquare pour un poste de liaison entre l''équipe support et l''équipe tech.',
    'Il s''agissait d''investiguer nos problèmes les plus complexes, impliquant différentes équipes (Data, App et des solutions tierces) avec de fortes volumétries et sur lesquelles on avait beaucoup de mal à avancer.',
    'C''était un poste inconfortable car unique chez Contentsquare, très transverse et donc sans appui managérial évident.',
    'Julien a su très vite s''approprier la forte complexité technique des différentes stack (Clickhouse, nodejs, kubernetes, adobe et google analytics), nouer une relation professionnelle forte avec l''ensemble des équipes.',
    'Il a su par la suite créer des outils pour systématiser sa méthode d''investigation pour que l''équipe support puisse être autonome.',
    'Cette mission a été un gros succès pour Contentsquare.'
  ]
from recommendations p
where p.slug = 'alexis-coudeyras'
on conflict (recommendation_id, locale) do update set author_role = excluded.author_role, relationship = excluded.relationship, paragraphs = excluded.paragraphs;

-- steeve-chevry
insert into recommendations_translations (recommendation_id, locale, author_role, relationship, paragraphs)
select p.id, 'fr',
  'CTO de transition & CTO as a service',
  'Responsable direct de Julien',
  array[
    'Julien, malgré son manque d''expérience lors de son arrivée dans mon équipe, a été extrêmement rapide à s''intégrer et à appréhender nos technologies.',
    'Il a sur faire preuve de sérieux, d''investissement et a été curieux et intéressé même par les aspects les moins excitants de ses responsabilités.',
    'Il a montré une extraordinaire qualité d''adaptation et d''apprentissage, et n''a jamais eu peur du moindre challenge. Il se donne toujours à fond dans ce qu''il produit, et j''ai toujours été extrêmement satisfait de la qualité de nos échanges, et du travail fournis.',
    'Pour conclure, je recommanderais fortement Julien, surtout qu''il sait être autonome et être force de proposition, et est très efficace en télétravail, ce qui est une vrai force et une qualité indéniable de nos jours.'
  ]
from recommendations p
where p.slug = 'steeve-chevry'
on conflict (recommendation_id, locale) do update set author_role = excluded.author_role, relationship = excluded.relationship, paragraphs = excluded.paragraphs;

-- eric-bisceglia
insert into recommendations_translations (recommendation_id, locale, author_role, relationship, paragraphs)
select p.id, 'fr',
  'Consulting technique',
  'Responsable direct de Julien',
  array[
    'Pendant le temps que j''ai eu Julien dans mon équipe, j''ai été systématiquement impressionné par sa capacité à prendre en main des sujets qui lui sont étrangers. Il a par exemple su devenir notre expert Streamsets en quelques mois d''utilisation de la plateforme, ou travailler efficacement avec du legacy iOS en une journée alors qu''il n''y connaissait rien. Via ce talent d''adaptabilité, de montée en compétence express, et de debug de l''impossible, il a sauvé plus d''une fois la peau de notre équipe TMA, qui devait régulièrement prendre dans son scope sans avertissement préalable de nouveaux sujets complexes sur lesquels nous n''avions pas encore eu le temps de monter en expertise.'
  ]
from recommendations p
where p.slug = 'eric-bisceglia'
on conflict (recommendation_id, locale) do update set author_role = excluded.author_role, relationship = excluded.relationship, paragraphs = excluded.paragraphs;
