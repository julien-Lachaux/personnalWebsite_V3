# Lot 14, L14-15 partie a : support des e2e de l'API (dev-api)

Date : 20 nov. 2026. Branche `lot/14-garde-fous-ci`. Autorisation `tests` fd2ba1f4 (ticket L14-15).

## Fait

- **Base modèle** (`test/support/global-setup.ts`). À chaque run, le `globalSetup` supprime puis crée
  `<base>_model` (`siteperso_test_model`), et y applique `resetDatabase` : schéma vidé, 16 migrations,
  tous les seeds, soit la séquence d'avant. Le modèle n'est jamais réutilisé d'un run à l'autre : une
  migration ou un seed modifié ne peut donc pas le périmer.
- **Une base par processus Vitest** (`test/support/database.ts`). Le nom se déduit de `VITEST_POOL_ID`
  (`siteperso_test_w<n>`, `n` vaut 1 quand la variable est absente) et de la base de `DATABASE_URL`
  (le suffixe `_w<n>` d'une URL déjà dérivée est retiré : idempotent). Le `globalSetup` crée les
  bases `_w1` à `_wN` (`N = project.config.maxWorkers`, 1 quand `fileParallelism` est à `false`), pour
  qu'un fichier qui ne recrée pas la base (health, docs) la trouve migrée et seedée comme avant.
- **`resetTestDatabase()`** : `drop database if exists … with (force)` puis
  `create database … template <modèle>`, par une connexion d'administration (base `postgres`).
  Les connexions encore ouvertes (pool de l'application, `openTestSql()`) sont coupées par `force` et
  postgres.js les rouvre à la requête suivante. Vérifié : 10 tours consécutifs (test dédié), 8 runs
  parallèles et 4 runs en série sans erreur de connexion.
- **Appelants** : `testDatabaseUrl()` (CLI, runners, seeds, `provisionApiRole`…) et `openTestSql()` visent
  la base du processus. `startTestApp()` et `appWithOverrides()` appellent `useWorkerDatabase()` qui
  pose `process.env.DATABASE_URL` sur cette base avant `createApp` (qui la lit dans l'environnement).
  `create-app.e2e-spec.ts` appelle `createApp` sans passer par le support : il garde la base
  `siteperso_test` du `DATABASE_URL` de la configuration (connexion paresseuse, aucune requête).
- **Tests des seeds et des migrations** : lus un par un, ils appellent toujours `runSeeds`,
  `runMigrations` ou `resetDatabase` sur les vrais fichiers, avec `testDatabaseUrl()` ; `reset.e2e-spec`
  appelle toujours `resetDatabase` directement. Seul `resetTestDatabase()` ne rejoue plus rien (voir
  la preuve). `api-role.e2e-spec` : les droits sur la base (`grant connect`) sont désormais perdus à
  chaque recopie, ce qui est plus hermétique ; le rôle, global au serveur, est toujours supprimé par le test.
- **Preuve d'équivalence** (`test/db/template-database.e2e-spec.ts`, 6 tests). Une base construite par
  `resetDatabase` dans une base séparée sert de référence ; la base du processus, après
  `resetTestDatabase()`, doit lui être égale sur : tables, colonnes (type, défaut, identité, nullabilité,
  ordre), contraintes (définition), index, séquences (paramètres et `last_value`), types énumérés,
  routines, déclencheurs, propriétaires et droits des relations et du schéma, droits par défaut,
  contenu de chaque table (lignes triées) et `schema_migrations` (version, nom, empreinte ; `applied_at`
  est le seul champ non déterministe, vérifié non nul). Gardes contre une comparaison creuse (tables et
  lignes présentes, séquences avancées, plus de 10 migrations). Elle prouve aussi que la copie efface
  les altérations précédentes (données, colonne, table, index, séquence, et schéma vidé) et que les
  connexions coupées se rouvrent. Sensibilité vérifiée en altérant le modèle à la main (hors commit) :
  une mise à jour de ligne, un index, un `nextval`, une empreinte de migration, un type de colonne
  ou un commentaire de table font tous échouer le test.

## Mesures (au mur, `pnpm --filter @siteperso/api test:e2e`, 16 coeurs)

| Configuration | Run 1 | Run 2 | Tests |
|---|---|---|---|
| Avant (71ff6b5), série | 222 s | 278 s | 758 |
| Après, série (`fileParallelism: false`, config actuelle) | 129 s | 127 s | 764 |
| Après, parallèle (`vitest run --project e2e --fileParallelism`) | 29 s | 36 s | 764 |

Runs parallèles de contrôle faits avant les deux runs ci-dessus : 21, 24, 20, 21, 24, 24 s (tous verts). Les 6 tests
en plus sont ceux de la preuve. Il reste environ 100 s en série qui ne viennent pas des remises à zéro
(imports de Nest par SWC, redémarrage de l'application dans chaque fichier) : seul le parallélisme les
absorbe.

Autres résultats : `pnpm test:coverage` 100 % (1194 tests, dont 430 unitaires), 100 % aussi en
parallèle (`vitest run --fileParallelism --coverage`, 29 s) ; `pnpm check` vert dans le worktree
(341 s, `exit 0`).

## Demande pour le lead-architecte : `apps/api/vitest.config.ts`

Le support n'exige aucun ajout (ni `env`, ni `setupFiles`, ni `pool`) : la base du processus est
dérivée à l'exécution de `DATABASE_URL` et de `VITEST_POOL_ID`. Le passage en parallèle se résume à
retirer la ligne qui force la série (et son commentaire, devenu faux) :

```diff
           globalSetup: ['test/support/global-setup.ts'],
           environment: 'node',
-          // Un seul processus : l'application et sa connexion sont partagées entre les fichiers.
-          fileParallelism: false,
           testTimeout: 15_000,
```

et le commentaire de `globalSetup` : « Modèle migré et seedé construit une fois par run, une base par
processus recopiée du modèle (voir test/support/database.ts). ». Mesure locale (sans commiter) :
`vitest run --project e2e --fileParallelism`, 8 runs de 20 à 36 s, tous verts.
Le nombre de processus par défaut est `maxWorkers` de Vitest (coeurs moins un) ; sur un exécuteur CI à
2 coeurs, le gain sera moindre mais correct.

## Méthode retenue et alternatives écartées

- **Copie par `CREATE DATABASE … TEMPLATE`** : mesurée à quelques dizaines de millisecondes sur la
  base tmpfs, contre environ 1 s pour le rejeu. `DROP DATABASE … WITH (FORCE)` (PostgreSQL 16) coupe
  les connexions ouvertes sans faire échouer les suivantes.
- Écartée : **restaurer dans la même base** (truncate + insertion depuis un schéma modèle) : ne
  restaure ni le DDL modifié par les tests, ni les droits, ni les séquences à l'identique.
- Écartée : **un modèle par processus** : coûterait N rejeux complets au démarrage. Un seul modèle,
  copié N fois ; les copies concurrentes du même modèle fonctionnent (6 runs parallèles verts).
- Écartée : **réutiliser un modèle d'un run à l'autre** (exclu par le ticket : risque de péremption).
- Écartée : **fournir l'URL par `provide`/`inject` ou un `setupFiles`** : demande un changement de
  `vitest.config.ts` ; `useWorkerDatabase()` dans les deux fabriques d'application suffit.

## Non fait

- Aucun changement de `vitest.config.ts`, `package.json`, `turbo.json` (partie b, lead-architecte).
- Aucun code de production touché (`src/` inchangé).

## Points ouverts

- **Phase 3 de la mutation (Stryker)** : chaque processus Stryker lance son propre Vitest, donc son
  propre `globalSetup`, qui reconstruirait le même `siteperso_test_model` : collision. Il faudra faire
  dériver le nom de `<base>` d'un identifiant du processus Stryker (par exemple `DATABASE_URL` distinct
  par processus, ou un préfixe lu dans l'environnement). Le support est prêt : tout se déduit de
  `baseDatabaseName(DATABASE_URL)`.
- Deux runs Vitest simultanés sur le même PostgreSQL de test se marchent dessus (comme avant : une
  seule base) ; deux worktrees isolés (`POSTGRES_TEST_PORT` distinct) n'ont pas ce souci.
- Après un run parallèle, des bases `siteperso_test_w2…` restent dans le PostgreSQL de test (tmpfs,
  jetable) ; elles sont recréées au run parallèle suivant et ne sont jamais utilisées en série.

## Commits

Voir `git log` de la branche : `test(api): base modèle et une base par processus Vitest pour les e2e`
(porte `Justification-test: L14-15`), `test(api): preuve qu'une base recopiée du modèle égale une base
migrée et seedée`, et ce compte rendu.
