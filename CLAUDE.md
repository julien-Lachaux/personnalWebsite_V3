# CLAUDE.md : conventions du dépôt pour tous les agents

Site perso V3 de Julien, back-end TypeScript. Les décisions de référence sont dans `docs/` :
`00-etat-des-lieux-v2.md`, `01-modele-de-donnees.md` (tables et contrat d'API),
`02-stack-technique.md`, `03-organisation-agents.md` (lots, rôles, flux git). Elles sont validées :
on les applique, on ne les rediscute pas dans le code.

## Structure

```
apps/api/                 API NestJS 12 sur Fastify (ESM), architecture hexagonale
  src/domain/             types et règles métier : AUCUNE dépendance Nest, Drizzle, Fastify
  src/application/        cas d'usage et ports (interfaces) : classes pures, pas de décorateur
  src/infrastructure/
    config/               variables d'environnement validées par Zod (APP_CONFIG)
    db/                   Drizzle + driver postgres, implémentation des ports (DATABASE_CLIENT)
    http/                 Nest : create-app.ts, app.module.ts, problem/, health/, docs/,
                          puis un dossier par ressource (profile/, skills/, cv/…)
  src/cli/                points d'entrée Node sans Nest : migrate.ts, seed.ts, reset.ts (scripts db:*),
                          provision-api-role.ts (rôle PostgreSQL de lecture seule de l'API, prod)
  test/                   tests e2e (*.e2e-spec.ts) via app.inject contre le Postgres de test ;
                          test/support/database.ts : resetTestDatabase(), openTestSql()
packages/contracts/       schémas Zod partagés + document OpenAPI 3.2.0 (createOpenApiDocument)
db/migrations/            SQL manuel NNNN_description.sql (source de vérité du schéma)
db/seeds/                 contenu SQL idempotent (upsert sur slug)
docker-compose.yml        postgres (dev, :5432) et postgres-test (:5433, tmpfs) ; ports et nom de
                          projet surchargeables par un `.env` racine (worktrees en parallèle)
docs/                     décisions validées ; ne pas reformater (exclu de Prettier)
docs/comptes-rendus/      compte rendu de chaque agent (lot-N-role.md)
```

## Règles hexagonales

- Dépendances dans un seul sens : `infrastructure` → `application` → `domain`. Le domaine
  n'importe rien d'externe ; l'application n'importe que le domaine, `@siteperso/contracts`
  et ses propres ports.
- Nest n'apparaît que dans `infrastructure/http` (et dans les modules Nest de `config`/`db`).
  Les cas d'usage sont des classes sans décorateur, fournis aux modules par `useFactory`
  avec `inject: [PORT_TOKEN]` (voir `health/health.module.ts`).
- Les ports sont des interfaces TypeScript + un jeton `Symbol` dans `application/.../ports/`.
  L'implémentation Drizzle vit dans `infrastructure/db/`. Les dépôts reçoivent
  `DrizzleDatabaseClient` à la construction et utilisent `client.db` ; ce sont des classes sans
  décorateur ni import de Nest (seul `db/database.module.ts` en importe), câblées par les modules de
  `infrastructure/http` en `useFactory` + `inject: [DrizzleDatabaseClient]`. `src/architecture.spec.ts`
  vérifie ces règles d'import.
- Pas de décorateurs métier, pas de pipes de validation magiques : les DTO et query params
  sont des schémas Zod de `@siteperso/contracts`, validés par un appel explicite
  (`Schema.safeParse`) dans le controller.
- Le SQL de `db/migrations` est la source de vérité ; le schéma Drizzle en découle, jamais
  l'inverse. Pas de `drizzle-kit generate`.
- Erreurs : le domaine lève des `DomainError` (`EntityNotFoundError` → 404). Le code HTTP
  lève des `HttpException` Nest. Le filtre global `ProblemDetailsFilter` traduit tout en
  RFC 9457 `application/problem+json` ; une erreur inattendue donne un 500 au détail
  générique, jamais de message ni de pile.
- Réponses JSON stables et décrites dans le contrat OpenAPI. Toute nouvelle route est ajoutée
  dans `packages/contracts/src/openapi/document.ts` (`routes`, `namedSchemas`) avec ses schémas.
- Contrat OpenAPI **3.2.0** (plus haute version qu'`utoipa` 6 émet côté Rust), généré par
  `@asteasolutions/zod-to-openapi` (`OpenApiGeneratorV32`) ; `info.version` 1.0.0 = version du
  contrat. Les noms et descriptions viennent de `.meta({ id, description })` natif de Zod 4 :
  pas d'`extendZodWithOpenApi`, pas de `.openapi()`. Un schéma de réponse n'a pas de `.default()`
  (le générateur rendrait le champ optionnel) : `default` se met en annotation dans `.meta()`.

## Règle « modules isolés » (lot 3, deux agents en parallèle)

Chaque ressource de `docs/01` a déjà son module enregistré dans `AppModule` :
`src/infrastructure/http/<resource>/<resource>.module.ts` + `.controller.ts` (GET en 501).
Pour implémenter une ressource, un agent ne crée ou ne modifie des fichiers QUE dans :

- `apps/api/src/infrastructure/http/<resource>/`
- `apps/api/src/application/<resource>/` (cas d'usage, ports)
- `apps/api/src/domain/<resource>/` (types)
- `apps/api/src/infrastructure/db/<resource>/` (dépôt Drizzle)
- `apps/api/test/<resource>.e2e-spec.ts`
- `packages/contracts/src/<resource>/` (schémas Zod)

Fichiers PARTAGÉS, interdits aux agents de ressource : `app.module.ts`, `create-app.ts`,
`main.ts`, `problem/*`, `config/*`, `db/database.module.ts`, `db/drizzle-database-client.ts`,
`packages/contracts/src/index.ts`, `packages/contracts/src/openapi/document.ts`,
tout fichier de configuration racine. Si une ressource a besoin d'un changement partagé
(export dans `index.ts`, chemin OpenAPI), l'agent le signale dans son compte rendu et
l'orchestrateur l'applique en un commit dédié. Le module `cv` agrège les cas d'usage des
autres ressources : il les importe par leurs modules, sans dupliquer de requête.

## Conventions de code

- TypeScript strict (`tsconfig.base.json`), ESM, imports relatifs avec extension `.js`.
- Identifiants en anglais ; commentaires, messages d'erreur, documentation en français.
- `import { type X }` pour les types ; une classe utilisée comme type de paramètre de
  constructeur Nest s'importe en valeur (métadonnées de décorateurs).
- Tests : deux projets Vitest dans `apps/api/vitest.config.ts`, `unit` (`*.spec.ts` à côté du
  code, `pnpm test`) et `e2e` (`test/**/*.e2e-spec.ts`, `pnpm test:e2e`), tous deux transformés
  avec SWC (`unplugin-swc`) : esbuild n'émet pas les métadonnées de décorateurs dont Nest dépend.
  Un module de ressource livre les deux.
- Couverture 100 % obligatoire (lignes, branches, fonctions, instructions) sur `apps/api/src` et
  `packages/contracts/src`, mesurée en une passe fusionnée unitaires + e2e (`pnpm test:coverage`,
  dans `pnpm check` et en CI). Aucun fichier de production exclu de la mesure, aucun commentaire
  d'ignore (`v8 ignore`, `c8 ignore`, `istanbul ignore`) : du code que l'application n'exécute
  jamais se supprime, il ne se masque pas. Un point d'entrée (`main.ts`, `cli/*.ts`) se teste en
  important le module avec `vi.mock` de ce qu'il orchestre. Chaque test vérifie un comportement
  (assertion utile), pas une ligne.
- `@siteperso/contracts` est consommé via son `dist/` : Turborepo le compile avant `lint`,
  `typecheck`, `test`, `test:e2e`, `test:coverage` et `build` (`dependsOn: ^build`), et
  `pnpm dev` le compile avant de lancer l'API. Après une modification des contrats pendant
  `pnpm dev`, relancer `pnpm --filter @siteperso/contracts build`.
- Pas de `console.log` : `Logger` de Nest dans `infrastructure`, rien dans `domain`/`application`.
- Prettier et ESLint font foi : `pnpm format` avant de committer.

## Commandes

Prérequis sur l'hôte : Docker (avec `docker compose`) et pnpm 10 (>= 10.34.5 : les versions 9.x sont visées par des avis de sécurité sans correctif). pnpm télécharge lui-même
la version de Node fixée dans `.npmrc` (`use-node-version`, Node 26 = dernière ligne stable,
docs/02) et l'utilise pour tous les scripts ; `engines.node` vaut `>=26 <27`.

```sh
pnpm install                 # dépendances, Node via pnpm, hook pre-commit husky
pnpm db:up                   # postgres de dev (docker compose)
pnpm db:migrate              # applique db/migrations (checksum, transaction par fichier)
pnpm db:seed                 # rejoue db/seeds (idempotents) ; refusé si une migration est en attente
pnpm db:reset                # drop schema public + migrate + seed (refusé en production)
pnpm db:test:up              # postgres de test
pnpm dev                     # compile les contrats puis API en watch sur http://localhost:3000/api/v1
pnpm lint | typecheck | test | test:e2e | build
pnpm test:coverage           # unitaires + e2e en une passe, couverture fusionnée, échoue sous 100 %
pnpm check                   # tout : démarre le postgres de test puis lint, typecheck, unit, e2e, couverture
pnpm format                  # Prettier sur tout le dépôt (docs/ exclu)
pnpm db:down                 # arrête les conteneurs
```

La configuration de l'API est lue dans `apps/api/.env` (modèle : `.env.example`, à copier,
jamais commité). Les e2e n'en ont pas besoin : le projet `e2e` de `vitest.config.ts` pointe par
défaut sur le postgres de test.

## Worktrees en parallèle

Deux agents qui lancent `pnpm check` en même temps doivent isoler leurs conteneurs : chacun
crée un `.env` à la racine de SON worktree (gitignoré) avec `COMPOSE_PROJECT_NAME`,
`POSTGRES_PORT` et `POSTGRES_TEST_PORT` qui lui sont propres (ex. `siteperso-v3-b`, 5442, 5443),
et un `apps/api/.env` dont `DATABASE_URL` pointe sur son `POSTGRES_PORT`. `docker compose` et
`apps/api/vitest.config.ts` lisent ce `.env` racine. `pnpm db:down` n'arrête alors que ses conteneurs.

## Flux git et interdictions

- Branche d'intégration : `v3/backend`. Une branche et un worktree par lot
  (`lot/N-nom`). Fusion par l'orchestrateur en `--no-ff` après recette.
- Commits atomiques, un par micro-tâche, Conventional Commits en français :
  `feat(api): …`, `feat(contracts): …`, `feat(db): …`, `test(api): …`, `chore: …`, `docs: …`.
  Chaque message se termine par une ligne vide puis
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Aucun commit si `lint`, `typecheck` et `test` ne passent pas (hook pre-commit) ; les e2e
  doivent aussi passer avant de livrer un lot (`pnpm check`).
- JAMAIS de `git push` par un agent. Jamais de `--no-verify`, jamais de `git stash` nu.
- Aucun e-mail, téléphone ou donnée personnelle de Julien dans le dépôt (code, SQL, tests,
  docs) : placeholders uniquement.
- Traductions EN du contenu : produites par l'agent base de données (lot 1) dans les seeds et
  marquées « à relire » pour Julien. Chaque traduction produite est listée dans
  `docs/traductions-a-relire.md` (table, slug, champ, texte FR, texte EN proposé) ; Julien
  relit puis retire les lignes validées. Aucune traduction n'est considérée définitive avant.
- Rien d'installé globalement sur l'hôte en dehors de Docker et pnpm : PostgreSQL uniquement
  en Docker, Node téléchargé par pnpm. Pas de `npm i -g`, pas de `brew`/`apt` pour le projet.
- Versions de paquets : stables actuelles vérifiées sur npm (`pnpm view <pkg> version`),
  épinglées exactement dans les `package.json`. Node : toujours la dernière ligne stable
  (https://nodejs.org/dist/index.json) ; en cas d'incompatibilité, on en discute avec Julien
  avant de rétrograder quoi que ce soit.
- Périmètre : lecture seule, pas d'auth, pas de CRUD, pas de contact côté API (docs/01).
- Chaque agent termine par un compte rendu court : fait, non fait, décisions, points ouverts.
