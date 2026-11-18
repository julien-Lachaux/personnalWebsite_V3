# Lot 1 : SQL, runner, migrations, seeds, compte rendu du dev base de données

Branche `lot/1-sql` (worktree), au-dessus de `v3/backend`. Un commit atomique par ticket
(L1-01 à L1-13) plus un commit de tests de contraintes (L1-06) et ce compte rendu (L1-14).
Vérification finale le 18 novembre 2026 : `pnpm check` vert (lint, typecheck, tests unitaires,
e2e contre le postgres de test), `pnpm db:migrate` rejouable, `pnpm db:seed` rejouable.

## Fait

- L1-01 Runner de migrations (`infrastructure/db/migrations-runner.ts`, CLI `src/cli/migrate.ts`) :
  `schema_migrations (version, name, checksum, applied_at)`, tri par préfixe `NNNN`, refus de deux
  fichiers de même préfixe et de tout `.sql` mal nommé, une transaction par fichier, SHA-256
  comparé pour les fichiers déjà appliqués (erreur « checksum »), `pg_advisory_lock`, journal
  « appliquée » / « déjà appliquée ». Aucun import Nest.
- L1-02 Runner de seeds (`seeds-runner.ts`), `reset-database.ts` (drop schema public + migrate + seed,
  refusé avec `NODE_ENV=production`), CLI `seed.ts` et `reset.ts`, scripts `db:migrate`, `db:seed`,
  `db:reset` (API et racine), `test/support/database.ts` (`resetTestDatabase()`, `openTestSql()`),
  README, CLAUDE.md et db/README mis à jour.
- L1-03 à L1-07 Migrations `0001` à `0007` : 24 tables (13 de contenu, 11 `_translations`), enums
  `experience_kind`, `contract_type`, `work_mode`, domaine `locale_code`, contraintes de docs/01 et
  du backlog. Tests e2e de contraintes (`schema-constraints`).
- L1-08 Schéma Drizzle dérivé du SQL (`infrastructure/db/schema/*`), branché sur
  `DrizzleDatabaseClient` (`db` typé `PostgresJsDatabase<typeof schema>`), test e2e de conformité
  (colonne, type, nullabilité, tables). Pas de `drizzle-kit`.
- L1-09 à L1-12 Seeds `0001` à `0005` : profil, LinkedIn, 7 groupes et 34 compétences, 8 expériences
  (dont la pause en `kind = 'break'`), 3 certifications, 3 lignes de formation, 2 langues. FR et EN.
- L1-13 `seeds.e2e-spec.ts` : idempotence, traduction `fr` de chaque entité publiée, textes
  alternatifs, aucun e-mail ni téléphone dans toute colonne texte, toute URL en `https://`.
- L1-14 `docs/traductions-a-relire.md` : 68 lignes, une par commentaire `-- EN : à relire`
  (somme des `grep -c` sur `db/seeds/*.sql` = 68).

Critères vérifiés à la main sur la base de dev (`psqldev`) : tous les comptages du backlog
(profil 1 / 2 traductions, 7 groupes, 34 compétences, 8 expériences dont 1 pause sans société,
5 expériences FR avec réalisations, 8 traductions EN, 3 certifications, 2 langues, `en` = C1,
24 tables, `schema_migrations` = 7 lignes), seconde exécution de `db:migrate` et `db:seed` sans
effet, `NODE_ENV=production pnpm db:reset` refusé avec message explicite, D7 sur `db/`.

## Non fait

- Seeds de `projects`, `tools`, `resources` : volontairement vides (P5), les tables existent.
- `github` et `website` dans `social_links` : URL non fournies (P1).
- Aucun fichier image (portrait, logos) : produits par le front (P4).

## Décisions prises

- Locale : domaine SQL `locale_code` (check `fr`/`en`) partagé par toutes les tables de
  traduction ; en Drizzle, `customType` sur ce domaine.
- Clés étrangères des traductions nommées au singulier de la table parente (`skill_id`,
  `social_link_id`, `certification_id`…), PK composite `(…_id, locale)` et `on delete cascade`.
- Index supplémentaires non demandés : `experience_skills(skill_id)`, `project_skills(skill_id)`,
  `resources(group_id)` (jointures et `set null`).
- Le test de conformité Drizzle/SQL lit `information_schema.columns` (nullabilité) et
  `format_type` de `pg_attribute` (type exact : `text[]`, enums, domaine) plutôt que
  `data_type` seul, qui masque enums, domaines et tableaux.
- Compétences : 34, soit celles du tableau du CV éclatées en unités (« PHP (Symfony) » donne
  `php` et `symfony`, « Intégrations e-commerce (Magento) » donne `ecommerce-integrations` et
  `magento`, « développement agentique (Mastra) » donne `agentic-development` et `mastra`), plus
  5 ajoutées parce qu'elles figurent dans les stacks du CV : Elysia.js, Solid.js, MongoDB, HTML5,
  CSS. Niveau 3 partout (P2). Icônes : slug devicon que je connais (`apachekafka`, `css3`,
  `nodejs`…), sinon slug de la compétence (P3) ; `icon_path` null.
- Expériences : slugs `nopillo`, `pause-professionnelle`, `contentsquare`, `wynd-integration`,
  `wynd-etl`, `leboncoin`, `afluens`, `openclassrooms-mentor`. Dates au premier jour du mois,
  `date_end` renseignée pour toutes (aucune en cours). `sort_order` 1 à 8 dans l'ordre du CV.
  `company_url` null (le CV n'en donne pas). `location` du mentorat : « À distance » / « Remote ».
  `logo_path` `/images/logos/<slug>.svg` y compris pour les deux postes Wynd (deux fichiers à
  fournir) ; la pause n'a ni logo ni `logo_alt`.
- Contentsquare n'a pas de résumé dans le CV mais `summary` est `not null` : j'en ai rédigé un à
  partir des réalisations.
- Les achievements sont en texte brut, un élément par réalisation, sans point final.
- Formation (P6, 3 lignes) : `eemi` (2016), `openclassrooms-integrateur-web` (2015),
  `autodidacte` (début 2015 faute de date, `year_end` null), `sort_order` chronologique inverse.
- Marqueur EN : un commentaire `-- EN : à relire` au-dessus de chaque texte anglais qui diffère du
  français (un par champ, un par élément de liste). Les textes identiques (noms de technologies,
  villes, « LinkedIn ») ne sont ni marqués ni listés. Les seeds ont été produits par un script
  jetable (non versionné) pour garantir l'égalité entre marqueurs et lignes du tableau ; si
  Julien corrige un texte, il édite le seed et retire la ligne du tableau.
- Les seeds ne suppriment jamais : un lien `experience_skills` retiré d'un seed reste en base
  jusqu'à un `db:reset`.

## Points ouverts

1. `education.institution` n'est pas traduit (docs/01) : la ligne autodidacte affiche
   « Autodidacte » en EN aussi. Option : traduire `institution` ou le rendre nullable (docs/01 à
   amender, validation de Julien).
2. Début de la formation autodidacte (2015) : valeur par défaut faute de date dans le CV, à
   confirmer.
3. Icônes devicon non vérifiées en ligne (pas d'accès dans le lot) : `streamsets`, `posthog`,
   `magento`, etc. À contrôler par le front (lot 6) ou par Julien ; ajuster `icon`/`icon_path`
   par un nouveau seed.
4. Logos : le front doit fournir `/images/logos/<slug>.svg` pour les 7 entrées avec société
   (Wynd en double) et `/images/profile/portrait.jpg`.
5. Les conteneurs de `docker-compose.yml` ont des `container_name` fixes : deux worktrees
   d'agents lançant `pnpm db:up` ou `pnpm db:test:up` en même temps partagent la même base et
   leurs `reset` s'écrasent mutuellement. Les lots SQL et API ne devraient pas exécuter leurs
   e2e simultanément (ou utiliser `POSTGRES_TEST_PORT` et un `COMPOSE_PROJECT_NAME` distincts).
6. `README.md` (section Arborescence) dit encore « runner au lot 1 » pour `db/migrations/` :
   hors des lignes autorisées au lot 1, à corriger par le CdP.
7. L'e2e ne vérifie pas les traductions `en` de toutes les entités publiées (docs/01 : `en`
   optionnelle avec repli) ; les seeds les fournissent toutes.
8. Les e2e du lot 1 exigent `pnpm --filter @siteperso/contracts build` (turbo le fait via
   `pnpm test:e2e` ou `pnpm check`) ; la commande directe `pnpm --filter @siteperso/api test:e2e`
   sur un clone neuf échoue tant que `dist/` n'existe pas.
