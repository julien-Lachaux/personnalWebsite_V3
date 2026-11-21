# Backlog du back-end V3

Rédigé le 18 novembre 2026 par le chef de projet, dérivé strictement de `docs/01-modele-de-donnees.md`,
`docs/02-stack-technique.md` et `docs/03-organisation-agents.md`. Ces trois documents sont les décisions
validées ; ce backlog les décline en lots, tickets et critères d'acceptation. Il ne les remet pas en cause.

Révision du 18 novembre 2026, après recette du lot 0 : le backlog est aligné sur la structure réellement
livrée (noms de paquets, scripts, arborescence hexagonale par couches, compose, tests). À partir de
maintenant, la source de vérité des conventions est `CLAUDE.md` à la racine du repo, complété par ce
document pour les tickets et les critères. En cas de divergence entre les deux, `CLAUDE.md` fait foi et le
chef de projet corrige le backlog.

Conventions de ce document :

- Un ticket = une micro-tâche = au moins un commit atomique (Conventional Commits en français).
- Les critères d'acceptation sont formulés comme des commandes ou des tests ; « passe » signifie code de
  sortie 0. Les commandes se lancent à la racine du repo sauf mention contraire.
- Les chemins sont relatifs à la racine du monorepo.
- Les identifiants de code sont en anglais, le texte libre (commentaires, docs, messages) en français.
- `<resource>` désigne l'une des 12 ressources de l'API en kebab-case : `profile`, `social-links`,
  `skill-groups`, `skills`, `experiences`, `projects`, `tools`, `resources`, `certifications`, `education`,
  `languages`, `cv`.

## 0. Rappels transverses

### 0.1 Règles non négociables (reprises dans `CLAUDE.md`)

- Jamais de `git push` par un agent. Jamais de commit si `lint`, `typecheck` et `test` ne passent pas
  (hook pre-commit) ; les e2e doivent aussi passer avant de livrer un lot (`pnpm check`). Jamais de
  `--no-verify`, jamais de `git stash` nu.
- Commits atomiques, un par micro-tâche, format `type(scope): sujet` ou `type: sujet` en français
  (`feat(api): …`, `feat(contracts): …`, `feat(db): …`, `test(api): …`, `chore: …`, `docs: …`), suivi d'une
  ligne vide puis du trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Aucun e-mail, numéro de téléphone ni donnée personnelle de contact nulle part dans le repo
  (code, SQL, docs, tests, fixtures, `.env.example`). Les exemples utilisent des placeholders
  (`contact@example.com`, `+33 0 00 00 00 00`). Le nom, le titre, la localisation et les URL publiques de
  profils professionnels sont du contenu de CV publié et sont seedés ; l'e-mail et le téléphone jamais.
- Sur l'hôte : Docker (avec `docker compose`) et pnpm 10 (>= 10.34.5, lot 6) seulement. Node 26 est téléchargé par pnpm
  (`.npmrc`, `use-node-version=26.13.1`). PostgreSQL tourne uniquement en Docker (`docker-compose.yml`).
  Rien d'autre n'est installé globalement : `psql` s'exécute dans le conteneur (`docker compose exec`).
- Versions : chaque paquet est ajouté à sa version stable courante vérifiée avec `pnpm view <pkg> version`,
  jamais une version mémorisée, et épinglée exactement. Les versions installées au lot 0 sont en section 9.
- Flux Git : git flow depuis le lot 13 (décision de Julien du 19 nov. 2026). Branche d'intégration
  permanente `develop`, une branche et un worktree par lot créés depuis `develop` (`lot/0-fondations`,
  `lot/1-sql`, `lot/2-contrats`, `lot/3-api-a`, `lot/3-api-b`, `lot/4-qa`, `lot/5-devops`,
  `lot/6-corrections`, puis `lot/N-nom`), fusion `--no-ff` dans `develop` par l'orchestrateur après recette
  du chef de projet. Seule la session principale pousse, et uniquement `develop` ; `main` (fusion des
  `release/*` et `hotfix/*`), les étiquettes, le push de `main` et le déploiement sont réservés à Julien.
- Traductions EN du contenu : produites par l'agent base de données (lot 1), listées dans
  `docs/traductions-a-relire.md` et marquées « à relire » ; aucune n'est définitive avant relecture de Julien.

### 0.2 Définition de « terminé » (commune à tous les lots)

Un ticket est terminé quand toutes les conditions suivantes sont vraies. Un lot est terminé quand tous ses
tickets le sont et que le chef de projet a validé la livraison contre les critères du lot.

| # | Condition | Vérification |
|---|---|---|
| D1 | Lint propre | `pnpm lint` passe |
| D2 | Typecheck propre | `pnpm typecheck` passe |
| D3 | Tests verts (unitaires et e2e du périmètre touché) | `pnpm check` passe (démarre le Postgres de test puis lint, typecheck, `test` = unitaires, `test:e2e` = e2e) |
| D4 | Build propre | `pnpm build` passe |
| D5 | Commits atomiques, un par micro-tâche, Conventional Commits en français avec trailer `Co-Authored-By` | `git log --format=%B develop..HEAD` : chaque message matche `^(feat|fix|docs|chore|refactor|test|ci|build|perf|style)(\([a-z0-9-]+\))?: .+` et contient le trailer (vérification à la main par le chef de projet : pas de hook `commit-msg`) |
| D6 | Hook pre-commit non contourné | aucun commit n'a été fait avec `--no-verify` (déclaré dans le compte rendu) |
| D7 | Aucune donnée personnelle de contact | `git grep -nE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' -- ':!pnpm-lock.yaml'` ne remonte que des placeholders `@example.com` ou le trailer `noreply@anthropic.com` ; `git grep -nE '(\+33|0)[1-9]([ .-]?[0-9]{2}){4}' -- ':!pnpm-lock.yaml'` ne remonte que des placeholders `+33 0 00 00 00 00` |
| D8 | Conventions `CLAUDE.md` respectées (hexagonal par couches, Nest confiné à `infrastructure/http` et aux modules Nest de `config`/`db`, pas de décorateur métier, validation Zod explicite, SQL source de vérité, textes en français, identifiants en anglais) | `grep -rlE "@nestjs|from 'fastify'|drizzle-orm|from 'postgres'" apps/api/src/domain apps/api/src/application` ne renvoie rien ; revue du chef de projet |
| D9 | Compte rendu court livré | fichier `docs/comptes-rendus/lot-<N>-<role>.md` présent avec les sections « Fait », « Non fait », « Décisions prises », « Points ouverts » |
| D10 | Aucun fichier hors périmètre du lot modifié | `git diff --stat develop..HEAD` ne liste que les dossiers autorisés du lot |

### 0.3 Dépendances entre lots

```
lot 0 fondations ──┬── lot 1 SQL + seeds ──┐
                   └── lot 2 contrats ─────┴── lot 3 API (A ∥ B) ── lot 4 QA ──┐
                                                                               ├── lot 6 revues + corrections ── CdP : recette finale
                                           lot 5 DevOps (dès lot 0) ───────────┘
```

Points de contrôle où l'orchestrateur attend Julien : après le lot 0 (structure et conventions), et à la fin
(compte rendu du chef de projet).

### 0.4 Arborescence livrée au lot 0 et cible (référence pour tous les tickets)

Architecture hexagonale par couches (et non par module) : chaque ressource est répartie dans les trois
couches, sous un dossier `<resource>/` par couche. Les lignes marquées « (lot N) » n'existent pas encore.

```
personnalWebsite_V3/
  apps/api/                                   @siteperso/api : NestJS 12 sur Fastify 5 (ESM)
    src/main.ts                               bootstrap : createApp() puis listen
    src/domain/                               types et règles métier : AUCUNE dépendance Nest, Drizzle, Fastify
      errors/                                 DomainError, EntityNotFoundError (→ 404)
      <resource>/                             types métier de la ressource (lot 3)
    src/application/                          cas d'usage (classes sans décorateur) et ports
      ports/database-client.port.ts           port DATABASE_CLIENT (ping)
      health/get-health.use-case.ts
      <resource>/                             <verb>-<resource>.use-case.ts + ports/<resource>-repository.port.ts (lot 3)
    src/infrastructure/
      config/                                 env.schema.ts (Zod), env.ts (loadEnv), config.module.ts (APP_CONFIG)
      db/                                     database.module.ts, drizzle-database-client.ts (DrizzleDatabaseClient, client.db)
        schema/                               schéma Drizzle dérivé du SQL (lot 1)
        migrations-runner.ts, seeds-runner.ts runner minimal (lot 1)
        <resource>/                           drizzle-<resource>.repository.ts (lot 3)
      http/                                   Nest : create-app.ts (helmet, rate limit, CORS, préfixe api/v1, filtre), app.module.ts
        problem/                              ProblemDetailsFilter, toProblemDetails (RFC 9457)
        health/                               GET /health (ping SQL, 503 si base injoignable)
        docs/                                 GET /docs.json (contrat OpenAPI servi depuis les contrats)
        <resource>/                           <resource>.module.ts + <resource>.controller.ts (GET en 501 jusqu'au lot 3)
    src/cli/                                  migrate.ts, seed.ts, reset.ts : points d'entrée db:* (lot 1)
    test/*.e2e-spec.ts                        e2e via app.inject contre le Postgres de test (projet `e2e` de vitest.config.ts depuis le lot 7)
    test/support/test-app.ts                  startTestApp(), ALLOWED_ORIGIN
    test/support/database.ts                  resetTestDatabase() : migrate + seed sur la base de test (lot 1)
    test/db/*.e2e-spec.ts                     e2e du runner, du schéma et des seeds (lot 1)
    vitest.config.ts                          unitaires src/**/*.spec.ts (SWC, pas d'accès réseau)
    vitest.e2e.config.ts                      supprimé au lot 7 : projets unit + e2e dans vitest.config.ts, couverture fusionnée, seuils 100 %
  packages/contracts/                         @siteperso/contracts : schémas Zod + OpenAPI 3.2.0
    src/common/                               locale.ts (LocaleSchema, LocaleQuerySchema, DEFAULT_LOCALE), problem-details.ts
    src/health/health.ts                      HealthResponseSchema
    src/<resource>/                           schémas Zod de la ressource (lot 2)
    src/openapi/document.ts                   createOpenApiDocument() : paths relatifs à /api/v1 (servers)
    src/index.ts                              point d'entrée : exports de tout le paquet
    scripts/export-openapi.ts                 openapi:export → dist/openapi.json (non commité, produit au build)
  db/README.md                                conventions SQL (migrations, seeds, idempotence)
  db/migrations/NNNN_description.sql          source de vérité du schéma
  db/seeds/NNNN_description.sql               contenu idempotent (upsert sur slug)
  docker-compose.yml                          postgres (dev, 127.0.0.1:5432, volume) et postgres-test (127.0.0.1:5433, tmpfs)
  docker/                                     api.Dockerfile, compose.prod.yml, Caddyfile (lot 5)
  scripts/deploy/                             scripts shell de déploiement (lot 5)
  .github/workflows/ci.yml                    CI (lot 5)
  .husky/pre-commit                           pnpm turbo run lint typecheck test
  docs/                                       décisions (00-03), backlog, comptes-rendus/, traductions-a-relire.md (lot 1), revues/ (lot 6)
  CLAUDE.md, README.md, .env.example, .npmrc (use-node-version), turbo.json, eslint.config.js, tsconfig.base.json
```

Les 12 modules de ressources sont déjà enregistrés dans `AppModule` (`src/infrastructure/http/app.module.ts`,
tableau `RESOURCE_MODULES`) ; `health` et `docs` font partie du socle (lot 0). `apps/web/` (Nuxt) est hors
périmètre de ce backlog et n'est pas créé.

### 0.5 Règle « modules isolés » et fichiers partagés (reprise de `CLAUDE.md`)

Pour implémenter une ressource (lot 3), un agent ne crée ou ne modifie des fichiers QUE dans :

- `apps/api/src/infrastructure/http/<resource>/`
- `apps/api/src/application/<resource>/` (cas d'usage, `ports/`)
- `apps/api/src/domain/<resource>/` (types)
- `apps/api/src/infrastructure/db/<resource>/` (dépôt Drizzle)
- `apps/api/test/<resource>.e2e-spec.ts`
- `packages/contracts/src/<resource>/` (schémas Zod ; au lot 3, uniquement si un ajustement est indispensable
  et signalé dans le compte rendu)

Fichiers PARTAGÉS, interdits aux agents de ressource : `apps/api/src/main.ts`,
`src/infrastructure/http/{app.module.ts,create-app.ts}`, `src/infrastructure/http/problem/*`,
`src/infrastructure/http/health/*`, `src/infrastructure/http/docs/*`, `src/infrastructure/config/*`,
`src/infrastructure/db/{database.module.ts,drizzle-database-client.ts}`, `src/infrastructure/db/schema/*`,
`src/application/ports/*`, `src/domain/errors/*`, `test/support/*`, `packages/contracts/src/index.ts`,
`packages/contracts/src/openapi/document.ts`, `packages/contracts/src/common/*`, tout fichier de configuration
racine (`package.json`, `turbo.json`, `eslint.config.js`, `tsconfig*.json`, `docker-compose.yml`, `.husky/*`,
`CLAUDE.md`). Si une ressource a besoin d'un changement partagé (export dans `index.ts`, chemin OpenAPI,
colonne de schéma), l'agent le signale dans son compte rendu et l'orchestrateur l'applique en un commit dédié.

Les lots 1, 2, 4, 5 et 6 travaillent seuls sur leurs fichiers partagés (voir « Périmètre autorisé » de
chaque lot) ; cette règle ne vaut que pour le parallélisme du lot 3.

### 0.6 Commandes de référence

| Commande | Effet |
|---|---|
| `pnpm install` | dépendances, Node 26.13.1 via pnpm, hook pre-commit husky |
| `pnpm db:up` / `pnpm db:test:up` / `pnpm db:down` | Postgres de dev / Postgres de test (`--wait` sur le healthcheck) / arrêt des conteneurs |
| `pnpm dev` | compile `@siteperso/contracts` puis API en watch sur `http://localhost:3000/api/v1` (config dans `apps/api/.env`, modèle `.env.example`) |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | via Turborepo, chaque tâche dépend de `^build` (les contrats sont compilés avant) |
| `pnpm test` | tests unitaires seuls (`src/**/*.spec.ts`), sans base |
| `pnpm test:e2e` | e2e (`apps/api/test/**/*.e2e-spec.ts`) contre le Postgres de test ; un seul fichier : `pnpm --filter @siteperso/api test:e2e -- <nom>` |
| `pnpm check` | `db:test:up` puis `lint`, `typecheck`, `test`, `test:e2e` : obligatoire avant de livrer un lot |
| `pnpm format` / `pnpm format:check` | Prettier (`docs/` exclu) |
| `pnpm --filter @siteperso/contracts openapi:export` | régénère `packages/contracts/dist/openapi.json` |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:reset` | runner SQL sur `DATABASE_URL` de `apps/api/.env` (lot 1) |

---

## 1. Lot 0 — Fondations (LIVRÉ)

- **Objectif** : un monorepo qui s'installe, lint, typecheck, teste et démarre à vide, avec toutes les
  conventions posées pour que les lots suivants n'aient à toucher que leurs propres fichiers.
- **Dépendances** : aucune (part de `develop` qui ne contient que `docs/`).
- **Agent responsable** : Lead back-end (branche `lot/0-fondations`, partie de `6b88d33`).
- **Périmètre autorisé** : tout le repo sauf `docs/0*.md` et `docs/backlog.md`.
- **Statut** : livré et recetté le 18 novembre 2026, 14 commits atomiques (11 de livraison, 3 de correction
  après recette). `pnpm check` vert : lint, typecheck, 14 tests unitaires, 23 tests e2e. Compte rendu :
  `docs/comptes-rendus/lot-0-lead.md`. Les descriptions ci-dessous décrivent ce qui est livré ; les écarts
  avec la version initiale du backlog sont acceptés en recette et constituent désormais la convention.
- **Fusion** : `git merge --no-ff lot/0-fondations` dans `develop`. La branche ne contient pas `5201791`
  (`docs(pm): backlog`) ; aucun conflit attendu (fichier nouveau côté `develop`).
- **Point de contrôle 1** : validation par Julien de la structure et de `CLAUDE.md` avant lancement des
  lots 1, 2 et 5.

### L0-01 — Monorepo pnpm + Turborepo — livré `00064c0`

- **Livré** : `package.json` racine privé `siteperso-v3` (`packageManager: pnpm@9.0.0`, `engines.node:
  ">=22.11.0 <23"` à la livraison ; Node 26 depuis le lot 0 bis, pnpm 10.34.9 depuis le lot 6), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` (tâches `build`, `lint`,
  `typecheck`, `test`, `test:e2e`, toutes `dependsOn: ["^build"]`, `test:e2e` sans cache avec `env`
  `DATABASE_URL`, `PORT`, `HOST`, `CORS_ORIGIN`, `NODE_ENV`), `.npmrc` (`use-node-version=26.13.1`,
  `engine-strict`), `.nvmrc` (22), `.editorconfig`, `tsconfig.base.json` strict (`module: NodeNext`),
  `eslint.config.js` flat (typescript-eslint `recommendedTypeChecked` + `stylisticTypeChecked`,
  `consistent-type-imports`, Prettier en dernier), `.prettierrc.json`, `.prettierignore` (`docs/` exclu),
  `.gitignore` (`node_modules`, `dist`, `.env*` sauf `.env.example`, `coverage`, `.turbo`,
  `.claude/worktrees/`). Scripts racine : `build`, `lint`, `typecheck`, `test`, `test:e2e`, `check`,
  `format`, `format:check`, `db:up`, `db:test:up`, `db:down`, `dev`, `start`, `prepare`.
- **Écarts acceptés** : pas de `test:unit` (c'est `test`), pas de `lint:fix`, pas de `db:migrate`/`db:seed`
  (lot 1), Node téléchargé par pnpm plutôt qu'installé sur l'hôte.
- **Critères d'acceptation** (vérifiés) :
  - `pnpm install --frozen-lockfile` passe.
  - `node -e "const p=require('./package.json');process.exit(/^pnpm@10\./.test(p.packageManager)?0:1)"` passe.
  - `pnpm turbo run lint typecheck build --dry-run=json` liste les tâches pour `@siteperso/api` et `@siteperso/contracts`.
  - `pnpm lint` et `pnpm format:check` passent.

### L0-02 — Squelette `packages/contracts` — livré `3ac1d62`

- **Livré** : paquet `@siteperso/contracts` (ESM, consommé via `dist/` : `main`, `types`, `exports`),
  dépendances `zod` 4.6.7 et `@asteasolutions/zod-to-openapi` 9.1.0 + `openapi3-ts` 4.6.2 (générateur V32, OpenAPI 3.2.0, lit les `.meta({ id, description })` natifs de Zod 4,
  produit de l'OpenAPI 3.2.0 sans registre parallèle). `src/common/locale.ts` (`LocaleSchema` = `z.enum(['fr',
  'en'])`, `DEFAULT_LOCALE`, `LocaleQuerySchema` = `{ lang: LocaleSchema.default('fr') }`),
  `src/common/problem-details.ts` (`ProblemDetailsSchema` RFC 9457, `PROBLEM_JSON_CONTENT_TYPE`),
  `src/health/health.ts` (`HealthResponseSchema` = `{ status: 'ok', checks: { database: 'up'|'down' } }`),
  `src/openapi/document.ts` (`createOpenApiDocument()`, `API_VERSION` `1.0.0`, `API_PREFIX` `/api/v1` en
  `servers`, chemin `/health` avec 200 et 503, composant `ProblemDetails`), `src/index.ts`. Scripts `build`
  (tsc + `openapi:export`), `openapi:export` (`tsx scripts/export-openapi.ts` → `dist/openapi.json`), `lint`,
  `typecheck`, `test`. Tests : `locale.spec.ts`, `document.spec.ts`.
- **Écarts acceptés** : `@asteasolutions/zod-to-openapi` (OpenAPI 3.2.0, décision du lot 0 bis) plutôt que `zod-openapi` ; `openapi:export` écrit
  `dist/openapi.json` (non commité, produit au build) au lieu d'un `openapi/openapi.json` commité ; le document
  est aussi servi en direct par `GET /api/v1/docs.json` (voir L0-03). Les chemins du document sont relatifs à
  `/api/v1` (`servers`), donc `/health` et non `/api/v1/health`.
- **Critères d'acceptation** (vérifiés) :
  - `pnpm --filter @siteperso/contracts build` passe et produit `packages/contracts/dist/index.js`, `dist/index.d.ts` et `dist/openapi.json`.
  - `node -e "const o=require('./packages/contracts/dist/openapi.json');process.exit(o.openapi.startsWith('3.2')&&o.paths['/health']&&o.servers[0].url==='/api/v1'?0:1)"` passe.
  - `pnpm --filter @siteperso/contracts test` passe.

### L0-03 — API NestJS/Fastify hexagonale et socle HTTP — livré `8eadf96`, `0fa664c`, `b07626d`

- **Livré** : `apps/api` (`@siteperso/api`) en ESM, imports relatifs avec `.js`, SWC pour les métadonnées de
  décorateurs (`.swcrc`, `unplugin-swc` dans Vitest, `@swc-node/register` pour `pnpm dev` en `node --watch`).
  Couches `src/domain` (`DomainError`, `EntityNotFoundError`), `src/application` (`GetHealthUseCase` pur,
  port `DATABASE_CLIENT` = `Symbol` + interface `DatabaseClientPort.ping()`), `src/infrastructure/config`
  (`EnvSchema` Zod : `NODE_ENV`, `PORT` défaut 3000, `HOST` défaut `0.0.0.0`, `DATABASE_URL` obligatoire,
  `CORS_ORIGIN` obligatoire (liste séparée par des virgules), `RATE_LIMIT_MAX` défaut 100,
  `RATE_LIMIT_WINDOW_MS` défaut 60000, `TRUST_PROXY` défaut `false` ; `loadEnv()` lève un message explicite ;
  `ConfigModule` global fournit `APP_CONFIG`), `src/infrastructure/db` (`DrizzleDatabaseClient` : driver
  `postgres` paresseux, `db` Drizzle exposé aux dépôts, `ping()`, `close()` ; `DatabaseModule` global fournit
  `DrizzleDatabaseClient` et `DATABASE_CLIENT`, ferme le pool à l'arrêt), `src/infrastructure/http`
  (`create-app.ts` : `createApp()` sans `listen`, helmet sans CSP, `@fastify/rate-limit` par IP, CORS
  restreint à `CORS_ORIGIN` et aux méthodes GET/HEAD/OPTIONS, préfixe global `api/v1`, `ProblemDetailsFilter`
  global, shutdown hooks ; `app.module.ts` ; `problem/` : toute exception → `application/problem+json` avec
  `type`, `title`, `status`, `detail`, `instance`, 5xx journalisées sans fuite ; `health/` : `GET /health` →
  `{ status: 'ok', checks: { database: 'up' } }`, 503 problem+json si le ping SQL échoue ; `docs/` :
  `GET /docs.json` sert `createOpenApiDocument()` avec `cache-control: public, max-age=300`). `main.ts` =
  `createApp()` + `listen`. `.env.example` à la racine avec placeholders (copié en `apps/api/.env`).
- **Écarts acceptés** : pas de `pickTranslation` ni de `src/shared/` (le repli de langue est au lot 3,
  conformément à docs/03, en SQL dans chaque dépôt : voir le patron du lot 3) ; pas de règle ESLint
  `no-restricted-imports` : la règle hexagonale est écrite dans `CLAUDE.md` et vérifiée par grep (D8) ;
  `/health` fait un ping SQL (503 si base injoignable) au lieu d'un `{ status: 'ok' }` sans base ; helmet
  sans `content-security-policy` (choix assumé pour une API JSON), `x-frame-options: SAMEORIGIN` (défaut
  helmet) ; pas de `DATABASE_URL_TEST` (les e2e lisent `DATABASE_URL`, défaut dans le projet `e2e` de `vitest.config.ts`) ;
  pas de `nest-cli.json` (pas de CLI Nest, `tsc` seul) ; le 400 sur `?lang` invalide arrive avec les
  contrôleurs réels au lot 3 (routes en 501 pour l'instant).
- **Critères d'acceptation** (vérifiés) :
  - `pnpm --filter @siteperso/api build` produit `apps/api/dist/main.js` ; `pnpm --filter @siteperso/api typecheck` passe.
  - `grep -rlE "@nestjs|from 'fastify'|drizzle-orm|from 'postgres'" apps/api/src/domain apps/api/src/application` ne renvoie rien.
  - `pnpm db:up` puis `pnpm dev` : `curl -s http://localhost:3000/api/v1/health` = `{"status":"ok","checks":{"database":"up"}}` ; `curl -s -i http://localhost:3000/api/v1/inconnue` renvoie 404 `application/problem+json` conforme à `ProblemDetailsSchema` ; `curl -s -i http://localhost:3000/api/v1/health` contient `x-content-type-options: nosniff`, `x-frame-options`, `strict-transport-security`, `x-ratelimit-limit` et pas `x-powered-by`.
  - `pnpm db:down` puis `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/health` = `503`.
  - `cd apps/api && CORS_ORIGIN= node dist/main.js` échoue avec un message listant la variable manquante.

### L0-04 — Modules vides enregistrés pour les 12 ressources — livré `56498ee`

- **Livré** : pour chaque ressource, `apps/api/src/infrastructure/http/<resource>/<resource>.module.ts` et
  `<resource>.controller.ts` (`@Controller('<resource>')`, `@Get()` qui lève `NotImplementedException` →
  501 problem+json « implémentation prévue au lot 3 »), enregistrés dans `AppModule` via `RESOURCE_MODULES`
  dans l'ordre du contrat (docs/01).
- **Écarts acceptés** : les modules ont un contrôleur qui répond 501 (et non 404 sans contrôleur) : la route
  existe, seul le corps change au lot 3 ; pas de `.gitkeep` par couche ni de test `Test.createTestingModule` :
  la résolution des 12 modules est couverte par les 12 e2e en 501 (`test/errors.e2e-spec.ts`) et par le
  démarrage réel.
- **Critères d'acceptation** (vérifiés) :
  - `for m in profile social-links skill-groups skills experiences projects tools resources certifications education languages cv; do test -f apps/api/src/infrastructure/http/$m/$m.module.ts && test -f apps/api/src/infrastructure/http/$m/$m.controller.ts || exit 1; done` passe.
  - `grep -c "Module,$" apps/api/src/infrastructure/http/app.module.ts` ≥ 12 ; `pnpm --filter @siteperso/api test:e2e -- errors` passe (12 routes en 501).

### L0-05 — Dossiers `db/` — livré `9c78c64`

- **Livré** : `db/README.md` (convention `NNNN_description.sql` pour migrations et seeds, une migration
  appliquée ne se modifie jamais, snake_case, `text`, `not null` par défaut, FK explicites, tables
  `<table>_translations` à PK composite, idempotence des seeds par `on conflict (slug) do update`, références
  par `slug`, traductions `en` marquées « à relire », table `schema_migrations`), `db/migrations/.gitkeep`,
  `db/seeds/.gitkeep`.
- **Écarts acceptés** : un seul `db/README.md` (pas un par dossier) ; pas de `src/cli/{migrate,seed}.ts` ni de
  scripts `db:migrate`/`db:seed` : le runner et son câblage sont entièrement au lot 1 (L1-01, L1-02),
  conformément à docs/03.
- **Critères d'acceptation** (vérifiés) : `test -d db/migrations && test -d db/seeds && test -f db/README.md` passe ; `grep -q schema_migrations db/README.md` passe.

### L0-06 — Compose de développement — livré `8200d58`

- **Livré** : `docker-compose.yml` à la racine : `postgres` (`postgres:16-alpine`, conteneur
  `siteperso-v3-postgres`, base `siteperso`, port `127.0.0.1:${POSTGRES_PORT:-5432}`, volume nommé
  `siteperso_pgdata`, healthcheck `pg_isready`) et `postgres-test` (conteneur `siteperso-v3-postgres-test`,
  base `siteperso_test`, port `127.0.0.1:${POSTGRES_TEST_PORT:-5433}`, `tmpfs`, healthcheck). Identifiants
  de dev `siteperso`/`siteperso` (jamais exposés hors de la machine). Scripts `db:up` (`docker compose up -d
  --wait postgres`), `db:test:up` (`… postgres-test`), `db:down`.
- **Écarts acceptés** : fichier `docker-compose.yml` à la racine (et non `docker/compose.dev.yml`) ; pas de
  service `api` (l'API tourne sur l'hôte via le Node téléchargé par pnpm ; le conteneur API arrive au lot 5) ;
  `pnpm db:up` ne démarre que le Postgres de dev, `pnpm db:test:up` celui de test (`pnpm check` l'enchaîne).
  Le nom du réseau compose dérive du dossier courant (`<dossier>_default`, soit `wf_…_default` dans un
  worktree) : le lot 5 pose `name: siteperso-v3` si nécessaire.
- **Critères d'acceptation** (vérifiés) :
  - `docker compose config` passe ; `docker compose config | grep -cE "127\.0\.0\.1:"` ≥ 2 et aucune publication `0.0.0.0`.
  - `pnpm db:up && pnpm db:test:up` passent (`--wait` attend les healthchecks) ; `pnpm db:down` passe.

### L0-07 — Vitest : unitaires et e2e contre Postgres Docker — livré `119113a` (+ `b07626d`)

- **Livré** : `apps/api/vitest.config.ts` (unitaires `src/**/*.spec.ts`, SWC, aucun accès réseau) et
  `apps/api/vitest.e2e.config.ts` (fusionné dans `vitest.config.ts` au lot 7 ; `test/**/*.e2e-spec.ts`, `fileParallelism: false`, timeouts 15 s / 30 s,
  `env` par défaut : `NODE_ENV=test`, `PORT`, `CORS_ORIGIN=http://localhost:3001`,
  `DATABASE_URL=postgres://siteperso:siteperso@localhost:5433/siteperso_test`, chacun surchargeable par
  l'environnement). `test/support/test-app.ts` : `startTestApp()` (`createApp({ logger: false })`, `init`,
  `ready`, pas de port ouvert, requêtes par `app.inject`), `ALLOWED_ORIGIN`. Tests : `health.e2e-spec.ts`
  (200 avec base joignable, en-têtes helmet, CORS origine autorisée/refusée, préflight sans POST),
  `docs.e2e-spec.ts` (OpenAPI 3.2.0 avec `/health` et `ProblemDetails`), `errors.e2e-spec.ts` (12 routes en
  501 problem+json avec `instance`, 404 sous et hors préfixe, aucune pile), `rate-limit.e2e-spec.ts`
  (en-têtes `x-ratelimit-*`, 429 problem+json avec `retry-after`, comptage par IP). Unitaires :
  `get-health.use-case.spec.ts`, `env.spec.ts`, `problem-details.filter.spec.ts`.
- **Écarts acceptés** : fichiers `apps/api/test/*.e2e-spec.ts` et deux configurations Vitest (au lieu de
  `test/e2e/*.e2e.ts` en projets Vitest) ; `pnpm test` = unitaires, `pnpm test:e2e` = e2e ; pas de message
  dédié « Postgres de test injoignable » quand `postgres-test` est arrêté (les tests échouent sur
  assertion) ; pas de test `?lang=de` → 400 (routes en 501, test prévu au lot 3 par ressource et au lot 4 en
  matrice).
- **Critères d'acceptation** (vérifiés) :
  - `pnpm db:test:up && pnpm test:e2e` passe (23 tests).
  - `pnpm db:down && pnpm test` passe sans Postgres (14 tests).

### L0-08 — Hook pre-commit — livré `5c32fc3`

- **Livré** : husky 9, script `prepare`, `.husky/pre-commit` = `pnpm turbo run lint typecheck test` (lint,
  typecheck, unitaires ; les e2e sont dans `pnpm check` et en CI au lot 5).
- **Écarts acceptés** : pas de hook `commit-msg` ni de lint-staged ; le format des messages et le trailer
  sont vérifiés par le chef de projet (D5) ; les 14 messages du lot 0 ont été vérifiés à la main : tous
  conformes. Le hook n'exécute pas les e2e (lenteur, dépendance au Postgres de test) : `pnpm check` est
  obligatoire avant de livrer un lot.
- **Critères d'acceptation** (vérifiés) : `test -f .husky/pre-commit && grep -q "turbo run lint typecheck test" .husky/pre-commit` passe après `pnpm install` ; un commit introduisant une erreur de type est refusé (vérifié manuellement, commit non conservé).

### L0-09 — `CLAUDE.md` et `README.md` — livré `503f3c2`, `9edd328`

- **Livré** : `CLAUDE.md` (structure, règles hexagonales, règle « modules isolés » et liste des fichiers
  partagés pour le lot 3, conventions de code, commandes, flux git et interdictions, traductions EN à relire
  dans `docs/traductions-a-relire.md`, comptes rendus dans `docs/comptes-rendus/lot-N-role.md`). `README.md`
  (lancement en 4 commandes : `pnpm install`, `cp .env.example apps/api/.env`, `pnpm db:up`, `pnpm dev` ;
  vérifications curl ; `pnpm check` ; arborescence).
- **Écarts acceptés** : la règle de repli de locale est dans docs/01 et dans la description du schéma
  `Locale` des contrats ; `schema_migrations` est dans `db/README.md` ; `README.md` ne mentionne pas
  `db:migrate`/`db:seed` (lot 1 : L1-02 complète `README.md` et `CLAUDE.md`).
- **Critères d'acceptation** (vérifiés) :
  - `for s in "git push" "Co-Authored-By" "problem+json" "infrastructure/http" "modules isolés" "comptes-rendus" "traductions-a-relire" "db/migrations" ; do grep -q -- "$s" CLAUDE.md || exit 1; done` passe.
  - `grep -q "pnpm db:up" README.md && grep -q "pnpm dev" README.md` passe.
  - Critère D7 passe sur les deux fichiers.

### L0-10 — Vérification finale du lot 0 et compte rendu — livré `d57f534`, `7445604`

- **Livré** : `docs/comptes-rendus/lot-0-lead.md` (fait, non fait, décisions dont le tableau des versions
  exactes, écarts avec docs/02, points ouverts). Séquence complète rejouée : `pnpm install --frozen-lockfile`
  propre, `pnpm check` vert, API démarrée contre le Postgres de dev et vérifiée avec curl.
- **Écarts acceptés** : nom du fichier `lot-0-lead.md` (et non `lot-0-lead-backend.md`) : convention
  `lot-N-role.md` de `CLAUDE.md`.
- **Critères d'acceptation** (vérifiés) :
  - `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install --frozen-lockfile && pnpm build && pnpm check && pnpm db:down` passe ; `git status --porcelain` vide ensuite.
  - Critères D1 à D10 vérifiés par le chef de projet ; `git log --oneline 6b88d33..lot/0-fondations | wc -l` = 14.

---

## 2. Lot 1 — SQL : runner, migrations, seeds

- **Objectif** : une base PostgreSQL 16 entièrement créée et remplie par des fichiers SQL versionnés,
  appliqués par un runner minimal, avec le contenu du CV (novembre 2026) en FR et EN.
- **Dépendances** : lot 0 fusionné dans `develop`.
- **Agent responsable** : Dev base de données (branche `lot/1-sql`).
- **Périmètre autorisé** : `db/**`, `apps/api/src/infrastructure/db/**` (y compris `drizzle-database-client.ts`
  pour brancher le schéma, sans changer son API publique `db`/`ping`/`close`), `apps/api/src/cli/**`,
  `apps/api/test/db/**`, `apps/api/test/support/database.ts`, scripts `db:*` de `apps/api/package.json` et de
  `package.json` (rien d'autre dans ces fichiers), `db/README.md`, lignes `src/cli/` et `db:*` de `CLAUDE.md`
  et `README.md`, `docs/comptes-rendus/lot-1-*.md`, `docs/traductions-a-relire.md`.
- **Source du contenu** : `../personnalWebsite_V2/.claude/BRIEF-site-perso-v2.md`, section « Données du CV »
  (hors repo ; l'e-mail et le téléphone qui y figurent ne sont jamais recopiés).
- **Outil de vérification** (aucun `psql` sur l'hôte) : dans les critères ci-dessous, `psqldev` désigne
  `psqldev() { docker compose exec -T postgres psql -U siteperso -d siteperso -Atc "$1"; }` (base de dev,
  après `pnpm db:up && pnpm db:migrate && pnpm db:seed`). Pour la base de test : `postgres-test` et
  `siteperso_test`.

### L1-01 — Runner de migrations minimal

- **Description** : `apps/api/src/infrastructure/db/migrations-runner.ts` : fonction pure côté Node (driver
  `postgres` directement, aucune dépendance Nest) qui crée si besoin `schema_migrations (version text primary
  key, name text not null, checksum text not null, applied_at timestamptz not null default now())`, lit
  `db/migrations/*.sql` triés par nom (préfixe `NNNN`), refuse deux fichiers de même préfixe, applique chaque
  fichier non encore appliqué dans une transaction (`begin` … insertion dans `schema_migrations` … `commit`,
  `rollback` en cas d'erreur), compare le checksum SHA-256 des fichiers déjà appliqués et échoue si un fichier
  appliqué a été modifié. Verrou `pg_advisory_lock` pendant l'exécution. Journal : une ligne par fichier
  (appliqué / déjà appliqué), via `Logger` de Nest ou `process.stdout` dans le CLI (pas de `console.log` dans
  `infrastructure/db`). Point d'entrée `apps/api/src/cli/migrate.ts` (lit `DATABASE_URL` via `loadEnv()` de
  `infrastructure/config`). Scripts : `apps/api/package.json` `db:migrate` = `node --env-file-if-exists=.env
  --import @swc-node/register/esm-register src/cli/migrate.ts` ; racine `db:migrate` = `pnpm --filter
  @siteperso/api db:migrate`. `db/README.md` mis à jour (colonnes de `schema_migrations`, checksum).
- **Fichiers** : `apps/api/src/infrastructure/db/migrations-runner.ts`, `migrations-runner.spec.ts` (tri,
  détection de doublon de préfixe, checksum : tests purs sur des répertoires temporaires, sans base),
  `apps/api/src/cli/migrate.ts`, `apps/api/test/db/migrations-runner.e2e-spec.ts`, scripts, `db/README.md`.
- **Critères d'acceptation** :
  - `pnpm db:migrate` passe deux fois de suite ; la seconde exécution affiche « déjà appliquée » pour chaque fichier et `schema_migrations` n'a pas de doublon.
  - `pnpm --filter @siteperso/api test:e2e -- migrations-runner` passe : sur la base de test, un fichier SQL invalide placé dans un répertoire temporaire fait échouer le runner et aucune ligne n'est insérée dans `schema_migrations` (rollback) ; un fichier appliqué puis modifié provoque une erreur « checksum ».
  - `psqldev "select count(*) from schema_migrations"` = nombre de fichiers dans `db/migrations/`.
  - `grep -rl "@nestjs" apps/api/src/infrastructure/db/migrations-runner.ts apps/api/src/cli` ne renvoie rien.

### L1-02 — Runner de seeds idempotents, `db:reset`, base de test

- **Description** : `apps/api/src/infrastructure/db/seeds-runner.ts` : lit `db/seeds/*.sql` triés, exécute
  chaque fichier dans une transaction à chaque appel (les seeds sont idempotents par `on conflict (slug) do
  update`, pas de table de suivi), échoue si une migration est en attente. `src/cli/seed.ts` et
  `src/cli/reset.ts` (`drop schema public cascade; create schema public` + migrate + seed, refusé si
  `NODE_ENV=production`). Scripts `db:seed` et `db:reset` dans `apps/api/package.json` et à la racine.
  `apps/api/test/support/database.ts` : `resetTestDatabase()` (même séquence que `reset`, sur le
  `DATABASE_URL` du projet `e2e` de `vitest.config.ts`) et `openTestSql()` (connexion `postgres` brute pour les fixtures),
  utilisés par les e2e des lots 1, 3 et 4 en `beforeAll`. `README.md` : ajouter `pnpm db:migrate && pnpm
  db:seed` entre `pnpm db:up` et `pnpm dev` ; `CLAUDE.md` : ligne `src/cli/` dans le bloc Structure et
  commandes `db:*`.
- **Fichiers** : `apps/api/src/infrastructure/db/seeds-runner.ts`, `apps/api/src/cli/{seed.ts,reset.ts}`,
  `apps/api/test/support/database.ts`, scripts, `README.md`, `CLAUDE.md`.
- **Critères d'acceptation** :
  - `pnpm db:seed && pnpm db:seed` passe ; `psqldev "select count(*) from experiences"` identique avant et après la seconde exécution.
  - `NODE_ENV=production pnpm db:reset` échoue avec un message explicite.
  - `pnpm db:test:up && pnpm test:e2e` passe : les e2e du lot 1 appellent `resetTestDatabase()` et laissent la base de test migrée et seedée.

### L1-03 — Migration : enums, `profile`, `social_links`

- **Description** : `db/migrations/0001_enums.sql` (types `experience_kind` = `employment|freelance|break|mentoring`,
  `contract_type` = `cdi|freelance|none`, `work_mode` = `onsite|hybrid|remote`, domaine ou check de locale
  `locale in ('fr','en')`), `0002_profile.sql` (`profile` avec `check (id = 1)`, `profile_translations`
  PK `(profile_id, locale)`, FK `on delete cascade`, colonnes `title`, `headline`, `bio`, `availability`,
  `picture_alt` `not null`), `0003_social_links.sql` (`slug unique`, `kind`, `url`, `sort_order int not null
  default 0`, `published boolean not null default true`, `social_links_translations.label`, index
  `(published, sort_order)`). Chaque table de traduction porte la même PK composite et la même FK cascade.
- **Fichiers** : `db/migrations/0001_enums.sql`, `0002_profile.sql`, `0003_social_links.sql`.
- **Critères d'acceptation** :
  - `pnpm db:migrate` passe.
  - `psqldev "select enum_range(null::experience_kind)"` = `{employment,freelance,break,mentoring}`.
  - `psqldev "insert into profile (id, first_name, last_name, picture_path, location) values (2,'a','b','c','d')"` échoue (check id = 1).
  - `psqldev "insert into profile_translations (profile_id, locale, title, headline, bio, availability, picture_alt) values (1,'de','t','h','b','a','p')"` échoue (locale).

### L1-04 — Migration : `skill_groups`, `skills`

- **Description** : `0004_skills.sql` : `skill_groups` (slug unique, sort_order, published), `skill_groups_translations`
  (name, description), `skills` (slug unique, `group_id` FK `on delete restrict`, `level smallint check
  (level between 1 and 5)`, `icon text`, `icon_path text null`, sort_order, published, index `(group_id,
  published, sort_order)`), `skills_translations (name)`.
- **Fichiers** : `db/migrations/0004_skills.sql`.
- **Critères d'acceptation** :
  - `psqldev "insert into skills (slug, group_id, level, icon) values ('x', 1, 6, 'x')"` échoue (check level).
  - `psqldev "select indexname from pg_indexes where tablename='skills'"` contient un index sur `(group_id, published, sort_order)`.

### L1-05 — Migration : `experiences`, `experience_skills`

- **Description** : `0005_experiences.sql` : `experiences` (slug unique, `kind experience_kind not null`,
  `company text null`, `company_url`, `logo_path`, `contract_type contract_type null`, `work_mode work_mode
  null`, `date_start date not null`, `date_end date null`, `check (date_end is null or date_end >=
  date_start)`, `check (kind <> 'break' or company is null)`, sort_order, published, index `(published,
  date_start desc)`), `experiences_translations` (job_title, location null, summary, `achievements text[]
  not null default '{}'`, logo_alt null, stack_label null), `experience_skills (experience_id, skill_id,
  sort_order, PK (experience_id, skill_id))` avec FK cascade.
- **Fichiers** : `db/migrations/0005_experiences.sql`.
- **Critères d'acceptation** :
  - Insertion d'une expérience avec `date_end < date_start` échoue ; insertion `kind='break'` avec `company` non null échoue.
  - `psqldev "select data_type from information_schema.columns where table_name='experiences_translations' and column_name='achievements'"` = `ARRAY`.

### L1-06 — Migration : `projects`, `tools`, `resources`

- **Description** : `0006_projects_tools_resources.sql` conforme à `docs/01` : `projects` (slug, url null,
  repo_url null, image_desktop_path null, image_mobile_path null, `year smallint null`, sort_order, published),
  `projects_translations` (title, description, image_alt null), `project_skills` PK composite ; `tools`
  (slug, url null, icon_path null, …), `tools_translations` (name, family, description) ; `resources`
  (slug, url, `group_id` FK `skill_groups` null `on delete set null`, picture_path null, …),
  `resources_translations` (name, description, picture_alt null). Index `(published, sort_order)` partout.
- **Fichiers** : `db/migrations/0006_projects_tools_resources.sql`.
- **Critères d'acceptation** :
  - `psqldev "select table_name from information_schema.tables where table_schema='public' order by 1"` contient `projects`, `projects_translations`, `project_skills`, `tools`, `tools_translations`, `resources`, `resources_translations`.
  - Suppression d'un `skill_groups` référencé par une `resources` met `group_id` à null (test e2e dans `test/db/schema-constraints.e2e-spec.ts`).

### L1-07 — Migration : `certifications`, `education`, `languages`

- **Description** : `0007_certifications_education_languages.sql` : `certifications` (slug, issuer, `year
  smallint not null check (year between 1990 and 2100)`, url null, …), `certifications_translations (name)` ;
  `education` (slug, institution, `year_start smallint not null`, `year_end smallint null check (year_end is
  null or year_end >= year_start)`, url null, …), `education_translations (title, description)` ;
  `languages` (slug, `code text not null unique check (code ~ '^[a-z]{2}$')`, `cefr_level text null check
  (cefr_level in ('A1','A2','B1','B2','C1','C2'))`, …), `languages_translations (name, level_label)`.
- **Fichiers** : `db/migrations/0007_certifications_education_languages.sql`.
- **Critères d'acceptation** :
  - Insertion `cefr_level='Z9'` échoue ; insertion `code='fra'` échoue.
  - `psqldev "select count(*) from information_schema.tables where table_schema='public' and table_name <> 'schema_migrations'"` = 24 (13 tables de contenu : `profile`, `social_links`, `skill_groups`, `skills`, `experiences`, `experience_skills`, `projects`, `project_skills`, `tools`, `resources`, `certifications`, `education`, `languages` ; 11 tables `_translations`).

### L1-08 — Schéma Drizzle dérivé du SQL

- **Description** : `apps/api/src/infrastructure/db/schema/*.ts` : une définition Drizzle (`pgTable`,
  `pgEnum`) par table, recopiée du SQL (noms snake_case, types, nullabilité, enums), `schema/index.ts` les
  réexporte. `drizzle-database-client.ts` passe le schéma à `drizzle(this.sql, { schema })` et type `db` en
  `PostgresJsDatabase<typeof schema>` (seul changement autorisé dans ce fichier). Aucun `drizzle-kit` : le SQL
  reste la source de vérité. Test e2e qui compare, pour chaque table Drizzle, la liste `(colonne, type,
  nullable)` avec `information_schema.columns` de la base de test migrée, et échoue à la moindre divergence ou
  table manquante.
- **Fichiers** : `apps/api/src/infrastructure/db/schema/{index.ts,enums.ts,profile.ts,social-links.ts,skills.ts,experiences.ts,projects.ts,tools.ts,resources.ts,certifications.ts,education.ts,languages.ts}`, `apps/api/src/infrastructure/db/drizzle-database-client.ts`, `apps/api/test/db/schema-matches-db.e2e-spec.ts`.
- **Critères d'acceptation** :
  - `pnpm --filter @siteperso/api test:e2e -- schema-matches-db` passe.
  - `grep -rn "drizzle-kit" package.json apps/api/package.json pnpm-lock.yaml` ne renvoie rien.

### L1-09 — Seed : profil et liens sociaux (FR + EN)

- **Description** : `db/seeds/0001_profile.sql` : ligne `profile` id 1 (prénom, nom, `picture_path`
  `/images/profile/portrait.jpg`, localisation du CV), traductions `fr` (titre, accroche, bio = paragraphe
  « Profil » du CV, disponibilité, `picture_alt` descriptif « Portrait de … ») et `en` (traduction par
  l'agent, bloc précédé du commentaire `-- EN : à relire`). `db/seeds/0002_social_links.sql` : `linkedin`
  (URL du CV), `github` et `website` si connus (sinon absents : point ouvert P1). Jamais d'e-mail ni de
  téléphone. Upsert `on conflict (slug) do update` (et `on conflict (profile_id, locale)` pour les traductions).
- **Fichiers** : `db/seeds/0001_profile.sql`, `db/seeds/0002_social_links.sql`.
- **Critères d'acceptation** :
  - `psqldev "select count(*) from profile_translations"` = 2 et `psqldev "select count(*) from profile"` = 1.
  - `psqldev "select count(*) from social_links where kind in ('email','phone') or url ~* 'mailto:|tel:'"` = 0.
  - Critère D7 sur `db/seeds/`.

### L1-10 — Seed : groupes de compétences et compétences

- **Description** : `db/seeds/0003_skills.sql` : les 7 catégories du CV (« Langages et frameworks »,
  « Données et messagerie », « Intégration et ETL », « Analytics », « IA appliquée », « DevOps »,
  « Pratiques ») en `skill_groups` avec `sort_order` dans l'ordre du CV, traductions FR et EN (noms de
  groupes traduits, `-- EN : à relire`) ; chaque compétence listée en `skills` (slug kebab-case, `icon` =
  slug devicon quand il existe, sinon `icon_path` null et `icon` = slug générique, point ouvert P3),
  `level` 3 par défaut sauf décision documentée (point ouvert P2), nom `en` identique au `fr` pour les noms
  propres.
- **Fichiers** : `db/seeds/0003_skills.sql`.
- **Critères d'acceptation** :
  - `psqldev "select count(*) from skill_groups"` = 7 ; `psqldev "select count(*) from skills"` ≥ 30.
  - `psqldev "select count(*) from skills s where not exists (select 1 from skills_translations t where t.skill_id=s.id and t.locale='fr')"` = 0 (toute compétence a sa traduction `fr`).

### L1-11 — Seed : expériences, réalisations et pause professionnelle

- **Description** : `db/seeds/0004_experiences.sql` : les 8 entrées du CV. `kind` : `employment` (CDI),
  `freelance` (mission leboncoin), `break` (pause professionnelle : `company` null, `contract_type` null,
  `stack_label` = « Huile de coude »), `mentoring` (OpenClassrooms : `contract_type` `none`, `work_mode`
  `remote`). `date_start` / `date_end` au premier jour du mois, `date_end` null pour aucune (toutes
  terminées en novembre 2026). `work_mode` `hybrid` et `location` « Paris » / « Saint-Cloud » selon le CV.
  Traductions FR : `job_title`, `summary`, `achievements` (tableau, une réalisation par élément, texte
  brut), `stack_label` (stack complète en texte), `logo_alt` (« Logo de <société> ») ; traductions EN
  marquées `-- EN : à relire`. `logo_path` = `/images/logos/<slug>.svg` (fichiers fournis par le front,
  point ouvert P4). `experience_skills` : liaison vers les `skills` existants cités dans la stack (les
  technologies absentes du référentiel restent uniquement dans `stack_label`).
- **Fichiers** : `db/seeds/0004_experiences.sql`.
- **Critères d'acceptation** :
  - `psqldev "select count(*) from experiences"` = 8 ; `psqldev "select count(*) from experiences where kind='break'"` = 1 ; `psqldev "select count(*) from experiences where kind='break' and company is not null"` = 0.
  - `psqldev "select count(*) from experiences_translations where locale='fr' and cardinality(achievements) > 0"` ≥ 5.
  - `psqldev "select count(*) from experiences_translations where locale='en'"` = 8.
  - `psqldev "select count(*) from experiences e where not exists (select 1 from experience_skills es where es.experience_id = e.id) and e.kind <> 'break'"` = 0.
  - `grep -c "EN : à relire" db/seeds/0004_experiences.sql` ≥ 8.

### L1-12 — Seed : certifications, formation, langues

- **Description** : `db/seeds/0005_certifications_education_languages.sql` : 3 certifications du CV
  (émetteur, année), formation (autodidacte + EEMI 2016 + parcours OpenClassrooms 2015, en 1 à 3 lignes
  `education` selon le choix documenté, point ouvert P6), langues `fr` (langue maternelle, `cefr_level` null)
  et `en` (`C1`, « professionnel »). Traductions FR + EN (`-- EN : à relire`). `projects`, `tools`,
  `resources` : pas de seed (point ouvert P5), les tables restent vides et l'API renvoie `[]`.
- **Fichiers** : `db/seeds/0005_certifications_education_languages.sql`.
- **Critères d'acceptation** :
  - `psqldev "select count(*) from certifications"` = 3 ; `psqldev "select count(*) from languages"` = 2 ; `psqldev "select count(*) from education"` ≥ 1.
  - `psqldev "select cefr_level from languages where code='en'"` = `C1`.

### L1-13 — Tests d'idempotence, de couverture des traductions et d'absence de données personnelles

- **Description** : `apps/api/test/db/seeds.e2e-spec.ts` sur la base de test : `resetTestDatabase()` puis
  seed une seconde fois ; les comptages de toutes les tables sont identiques entre les deux passes ; chaque
  entité publiée possède une traduction `fr` ; chaque colonne `*_alt` non nulle pour les entités ayant un
  chemin d'image ; aucune valeur de colonne texte ne matche les regex e-mail / téléphone ; toute `url`
  commence par `https://`.
- **Fichiers** : `apps/api/test/db/seeds.e2e-spec.ts`.
- **Critères d'acceptation** :
  - `pnpm --filter @siteperso/api test:e2e -- seeds` passe.
  - `git grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|(\+33|0)[1-9]([ .-]?[0-9]{2}){4}" -- db/` ne renvoie rien.

### L1-14 — Liste des traductions à relire et compte rendu

- **Description** : `docs/traductions-a-relire.md` : tableau (fichier, slug, colonne, texte FR, texte EN
  proposé) de toutes les traductions produites par l'agent, à relire par Julien (format imposé par
  `CLAUDE.md` : table, slug, champ, texte FR, texte EN proposé ; Julien retire les lignes validées).
  `docs/comptes-rendus/lot-1-dev-db.md`.
- **Fichiers** : `docs/traductions-a-relire.md`, `docs/comptes-rendus/lot-1-dev-db.md`.
- **Critères d'acceptation** :
  - `grep -c "EN : à relire" db/seeds/*.sql` = nombre de lignes du tableau de `docs/traductions-a-relire.md` (hors en-tête).
  - Critères D1 à D10.

---

## 3. Lot 2 — Contrats : schémas Zod, types, OpenAPI

- **Objectif** : `@siteperso/contracts` décrit entièrement l'API en lecture seule (chaque ressource, `/cv`,
  `/health`, erreurs) sous forme de schémas Zod, de types exportés et d'un document OpenAPI 3.2.0 servi tel
  quel par `GET /api/v1/docs.json` et honoré à l'identique par le futur portage Rust.
- **Dépendances** : lot 0 fusionné. Indépendant du lot 1 (parallèle).
- **Agent responsable** : Dev contrats (branche `lot/2-contrats`).
- **Périmètre autorisé** : `packages/contracts/**`, `docs/comptes-rendus/lot-2-*.md`. Les fichiers partagés
  `src/index.ts`, `src/common/*` et `src/openapi/document.ts` sont à lui seul pendant ce lot.
- **Conventions livrées au lot 0 à respecter** : un dossier `src/<resource>/` par ressource ; métadonnées
  OpenAPI par `.meta({ id: 'Nom', description })` (zod-to-openapi lit les `.meta` natifs de Zod 4, pas de
  `.openapi()`) ; chemins déclarés dans `src/openapi/document.ts` relatifs à `/api/v1` (`servers`) ; schémas
  réutilisés tels quels par l'API (`safeParse` explicite) et par le front.

### L2-01 — Schémas communs

- **Description** : compléter `src/common/` : `LocaleSchema` et `LocaleQuerySchema` (existants, à conserver
  tels quels : `{ lang: LocaleSchema.default('fr') }`), `SlugSchema` (`^[a-z0-9]+(-[a-z0-9]+)*$`),
  `IsoDateSchema` (`YYYY-MM-DD`), `ImageSchema` (`{ path: string, alt: string }`), enums
  `ExperienceKindSchema`, `ContractTypeSchema`, `WorkModeSchema`, `CefrLevelSchema`, constantes `LOCALES`,
  `EXPERIENCE_KINDS`, `CONTRACT_TYPES`, `WORK_MODES`, `CEFR_LEVELS`. `ProblemDetailsSchema` et
  `HealthResponseSchema` existent déjà. Chaque schéma porte `.meta({ id, description })` et un exemple.
- **Fichiers** : `packages/contracts/src/common/{slug.ts,date.ts,image.ts,enums.ts}` et specs `*.spec.ts`.
- **Critères d'acceptation** :
  - `pnpm --filter @siteperso/contracts test` passe : `LocaleQuerySchema.parse({})` → `{ lang: 'fr' }` ; `LocaleQuerySchema.safeParse({ lang: 'de' }).success` = false ; `SlugSchema` rejette `Foo_bar` ; `IsoDateSchema` rejette `2026-13-01`.

### L2-02 — Schémas `profile`, `social-links`, `skills`, `skill-groups`

- **Description** : `ProfileSchema` (`firstName`, `lastName`, `location`, `picture: ImageSchema`, `title`,
  `headline`, `bio`, `availability` ; aucun champ e-mail/téléphone), `SocialLinkSchema` (`slug`, `kind`,
  `url`, `label`), `SkillSchema` (`slug`, `name`, `level` 1-5, `icon`, `iconPath` null, `groupSlug`),
  `SkillGroupSchema` (`slug`, `name`, `description`, `skills: SkillSchema[]`). Réponses : objet pour
  `/profile`, tableau pour les autres. Les objets de réponse sont `strict` (clé inconnue refusée) afin que
  les tests e2e détectent toute fuite de colonne.
- **Fichiers** : `packages/contracts/src/{profile/profile.ts,social-links/social-links.ts,skills/skills.ts,skill-groups/skill-groups.ts}`, specs.
- **Critères d'acceptation** :
  - Tests : un exemple valide par schéma passe ; `ProfileSchema.safeParse({ ...valid, email: 'contact@example.com' }).success` = false.
  - `grep -nEi "email|phone|tel\b" packages/contracts/src/profile/profile.ts` ne renvoie rien.

### L2-03 — Schémas `experiences`, `projects`, `tools`, `resources`

- **Description** : `ExperienceSchema` (`slug`, `kind`, `company` null, `companyUrl` null, `logo: ImageSchema |
  null`, `contractType` null, `workMode` null, `dateStart`, `dateEnd` null, `jobTitle`, `location` null,
  `summary`, `achievements: string[]`, `stackLabel` null, `skills: SkillSchema[]`), `ProjectSchema` (`slug`,
  `url`, `repoUrl`, `imageDesktop`, `imageMobile` (`ImageSchema | null`), `year`, `title`, `description`,
  `skills`), `ToolSchema` (`slug`, `url`, `iconPath`, `name`, `family`, `description`), `ResourceSchema`
  (`slug`, `url`, `groupSlug` null, `picture: ImageSchema | null`, `name`, `description`).
- **Fichiers** : `packages/contracts/src/{experiences/experiences.ts,projects/projects.ts,tools/tools.ts,resources/resources.ts}`, specs.
- **Critères d'acceptation** :
  - Tests : une expérience `kind: 'break'` avec `company: null` passe ; `dateStart: '2026-13-01'` est rejeté ; `achievements` doit être un tableau (chaîne rejetée).

### L2-04 — Schémas `certifications`, `education`, `languages`

- **Description** : `CertificationSchema` (`slug`, `issuer`, `year`, `url` null, `name`), `EducationSchema`
  (`slug`, `institution`, `yearStart`, `yearEnd` null, `url` null, `title`, `description`), `LanguageSchema`
  (`slug`, `code`, `cefrLevel` null, `name`, `levelLabel`).
- **Fichiers** : `packages/contracts/src/{certifications/certifications.ts,education/education.ts,languages/languages.ts}`, specs.
- **Critères d'acceptation** :
  - Tests : `LanguageSchema` rejette `cefrLevel: 'Z9'` ; `EducationSchema` rejette `yearEnd < yearStart` (raffinement).

### L2-05 — Schéma de l'agrégat `/cv`

- **Description** : `CvSchema` = `{ locale, profile, socialLinks, skillGroups, experiences, projects, tools,
  resources, certifications, education, languages }` composé des schémas précédents (`skills` n'est pas
  répété à plat : il est imbriqué dans `skillGroups`). Export `Cv` typé.
- **Fichiers** : `packages/contracts/src/cv/cv.ts`, spec.
- **Critères d'acceptation** :
  - Test : un exemple complet passe ; l'absence de `languages` est rejetée ; une clé supplémentaire est rejetée.

### L2-06 — Document OpenAPI 3.2.0 complet

- **Description** : `src/openapi/document.ts` déclare les 13 chemins (`/profile`, `/social-links`,
  `/skill-groups`, `/skills`, `/experiences`, `/projects`, `/tools`, `/resources`, `/certifications`,
  `/education`, `/languages`, `/cv`, plus `/health` existant ; relatifs à `servers` `/api/v1`) avec le
  paramètre de requête `lang` (`LocaleSchema`, sauf `/health`), les réponses `200` (`application/json`,
  schéma de la ressource), `400` et `404` (`application/problem+json`, `ProblemDetails`), `429` et `500`
  pour toutes, `503` pour `/health`. Tags par ressource. `info` inchangé (titre, version `1.0.0`,
  description en français). `GET /docs.json` est une méta-route hors contrat : elle n'apparaît pas dans
  `paths`. `openapi:export` reste déterministe (ordre stable des clés, indentation 2). Test :
  `document.spec.ts` valide le document avec un validateur OpenAPI 3.2 (dépendance de dev choisie avec `pnpm
  view`, consignée dans le compte rendu) et vérifie les 13 chemins, le paramètre `lang` sur 12 d'entre eux et
  les composants.
- **Fichiers** : `packages/contracts/src/openapi/document.ts`, `document.spec.ts`, `package.json` (dépendance de dev du validateur).
- **Critères d'acceptation** :
  - `pnpm --filter @siteperso/contracts build && node -e "const o=require('./packages/contracts/dist/openapi.json');const p=Object.keys(o.paths);process.exit(p.length===13&&p.every(k=>k.startsWith('/')&&!k.startsWith('/api'))&&o.servers[0].url==='/api/v1'?0:1)"` passe.
  - `grep -c '"name": "lang"' packages/contracts/dist/openapi.json` ≥ 12 ; `grep -c docs.json packages/contracts/dist/openapi.json` = 0.
  - `pnpm --filter @siteperso/contracts openapi:export` exécuté deux fois produit un fichier identique (`sha256sum`).

### L2-07 — Exports, types et compte rendu

- **Description** : `src/index.ts` exporte tous les schémas, les types `z.infer` (`Profile`, `SocialLink`,
  `Skill`, `SkillGroup`, `Experience`, `Project`, `Tool`, `Resource`, `Certification`, `Education`,
  `Language`, `Cv`, `ProblemDetails`, `HealthResponse`, `Locale`, `LocaleQuery`), les constantes d'enums et
  `createOpenApiDocument` (déjà exporté). `package.json` : `exports` inchangé (`.` vers `dist/`),
  `sideEffects: false`. `packages/contracts/README.md` mis à jour. Compte rendu
  `docs/comptes-rendus/lot-2-dev-contrats.md`.
- **Fichiers** : `packages/contracts/src/index.ts`, `packages/contracts/package.json`, `packages/contracts/README.md`, compte rendu.
- **Critères d'acceptation** :
  - `pnpm build` puis, depuis `apps/api` : `node --input-type=module -e "import('@siteperso/contracts').then(m=>process.exit(['ProfileSchema','CvSchema','ProblemDetailsSchema','LocaleQuerySchema','createOpenApiDocument'].every(k=>k in m)?0:1))"` passe.
  - `pnpm typecheck` passe avec un fichier de test de types dans contracts (`src/index.spec.ts`, `expectTypeOf<Cv>()`).
  - Critères D1 à D10.

---

## 4. Lot 3 — API : 12 modules en deux agents parallèles

- **Objectif** : chaque route du contrat répond avec des données issues de PostgreSQL via Drizzle, dans la
  langue demandée avec repli `en → fr`, triées par `sort_order` (ou `date_start desc` pour les
  expériences), limitées au contenu `published`, et validées par les schémas Zod des contrats avant envoi.
- **Dépendances** : lots 1 et 2 fusionnés dans `develop`.
- **Agents responsables** : Dev API A (branche `lot/3-api-a`) et Dev API B (branche `lot/3-api-b`), en
  parallèle, périmètres disjoints définis par la règle « modules isolés » (section 0.5 et `CLAUDE.md`).
- **Répartition** (6 modules chacun, équilibrée par complexité : A reçoit `experiences` et `skill-groups`
  imbriqué, B reçoit `cv` et `projects`) :

| Agent | Modules | Périmètre de fichiers (pour chaque `<resource>` de la liste) |
|---|---|---|
| A | `profile`, `social-links`, `skills`, `skill-groups`, `experiences`, `languages` | `apps/api/src/domain/<resource>/**`, `apps/api/src/application/<resource>/**`, `apps/api/src/infrastructure/db/<resource>/**`, `apps/api/src/infrastructure/http/<resource>/**`, `apps/api/test/<resource>.e2e-spec.ts`, `docs/comptes-rendus/lot-3-dev-api-a.md` |
| B | `projects`, `tools`, `resources`, `certifications`, `education`, `cv` | mêmes dossiers pour ses ressources, `docs/comptes-rendus/lot-3-dev-api-b.md` |

- **Patron commun à chaque module** (identique pour A et B, imposé par `CLAUDE.md`) :
  - `src/domain/<resource>/<resource>.ts` : types métier de la ressource (sans importer les contrats : le
    domaine n'importe rien d'externe ; la correspondance avec le type du contrat est faite dans l'application).
  - `src/application/<resource>/ports/<resource>-repository.port.ts` : interface `<Resource>Repository`
    (ex. `findAllPublished(locale: Locale): Promise<Experience[]>` / `findProfile(locale): Promise<Profile |
    null>`) et jeton `export const <RESOURCE>_REPOSITORY = Symbol('<RESOURCE>_REPOSITORY')`.
  - `src/application/<resource>/list-<resource>.use-case.ts` (ou `get-profile.use-case.ts`,
    `get-cv.use-case.ts`) : classe sans décorateur, reçoit le port par constructeur, retourne le type de
    `@siteperso/contracts`.
  - `src/infrastructure/db/<resource>/drizzle-<resource>.repository.ts` : injecte `DrizzleDatabaseClient`,
    utilise `client.db` et le schéma de `infrastructure/db/schema`. Repli de langue en SQL, en une requête :
    `inner join <t>_translations fr on … and fr.locale = 'fr'` + `left join <t>_translations en on … and
    en.locale = :lang`, chaque champ traduit en `coalesce(en.col, fr.col)` (pour `lang = 'fr'`, la jointure
    `en` est simplement vide). Filtre `published = true`, tri `sort_order asc, id asc`. Les entités
    imbriquées (`skills`) sont chargées en une seconde requête au plus (pas de N+1).
  - `src/infrastructure/http/<resource>/<resource>.controller.ts` : parse `?lang` avec
    `LocaleQuerySchema.safeParse(request.query)` (`@Query()` brut ; 400 `BadRequestException` → problem+json
    sinon), appelle le cas d'usage, valide la réponse avec le schéma du contrat (`strict`) avant de la
    renvoyer, 404 (`EntityNotFoundError` du domaine) si `/profile` n'a pas de ligne. Le `.module.ts` fournit le
    dépôt (`{ provide: <RESOURCE>_REPOSITORY, useClass: Drizzle<Resource>Repository }`) et le cas d'usage par
    `useFactory` + `inject: [<RESOURCE>_REPOSITORY]` (voir `health/health.module.ts`), et **exporte le cas
    d'usage** (`exports: [List<Resource>UseCase]`) pour `cv`.
  - Tests unitaires `*.spec.ts` à côté du code : cas d'usage avec un dépôt en mémoire (tri, filtrage,
    correspondance de types) ; test e2e `apps/api/test/<resource>.e2e-spec.ts` : `resetTestDatabase()` en
    `beforeAll`, puis `fr`, `en`, repli (suppression des lignes `en` via `openTestSql()` puis
    `resetTestDatabase()` en `afterAll`), `?lang=de` → 400, forme de la réponse validée par le schéma Zod
    strict.
- **Signatures des cas d'usage** (fixées ici pour que `cv` de l'agent B puisse composer ceux de l'agent A
  sans attendre) : `GetProfileUseCase.execute(locale)`, `ListSocialLinksUseCase.execute(locale)`,
  `ListSkillGroupsUseCase.execute(locale)`, `ListSkillsUseCase.execute(locale)`,
  `ListExperiencesUseCase.execute(locale)`, `ListProjectsUseCase.execute(locale)`,
  `ListToolsUseCase.execute(locale)`, `ListResourcesUseCase.execute(locale)`,
  `ListCertificationsUseCase.execute(locale)`, `ListEducationUseCase.execute(locale)`,
  `ListLanguagesUseCase.execute(locale)` ; `locale: Locale` de `@siteperso/contracts`, retour `Promise<T>` du
  type du contrat. Chaque module exporte son cas d'usage comme provider Nest sous son nom de classe.
- **Fichiers partagés** : aucun agent ne touche `app.module.ts`, `create-app.ts`, `problem/*`, `config/*`,
  `db/database.module.ts`, `db/drizzle-database-client.ts`, `db/schema/*`, `test/support/*`,
  `packages/contracts/src/{index.ts,common/*,openapi/document.ts}`. Tout besoin (colonne manquante, schéma de
  contrat à ajuster, export) est signalé dans le compte rendu ; l'orchestrateur l'applique en un commit dédié
  sur `develop` avant la fusion.

### L3-01 (A) — Module `profile`

- **Description** : `GET /api/v1/profile` selon le patron commun. 404 problem+json si aucune ligne.
- **Fichiers** : dossiers `<resource>` = `profile` dans les quatre couches, `apps/api/test/profile.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : `GET /api/v1/profile` → 200, corps validé par `ProfileSchema` strict ; `?lang=en` → `title` en anglais ; après suppression de la ligne `en` → `?lang=en` renvoie le `fr` ; `?lang=de` → 400 problem+json ; profil supprimé → 404 problem+json.
  - `curl -s http://localhost:3000/api/v1/profile | grep -ciE "@|tel"` = 0.

### L3-02 (A) — Module `social-links`

- **Description** : `GET /api/v1/social-links`, tableau trié par `sort_order`, `published` seulement.
- **Fichiers** : dossiers `social-links`, `apps/api/test/social-links.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : 200, tableau validé par `z.array(SocialLinkSchema)` ; un lien mis `published=false` dans le test disparaît ; ordre = `sort_order`.

### L3-03 (A) — Module `skills`

- **Description** : `GET /api/v1/skills`, tableau plat avec `groupSlug`, tri par `sort_order`.
- **Fichiers** : dossiers `skills`, `apps/api/test/skills.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : 200, ≥ 30 éléments validés par `SkillSchema` ; `en` identique au `fr` pour un nom propre ; une compétence non publiée est exclue.

### L3-04 (A) — Module `skill-groups` (skills imbriqués)

- **Description** : `GET /api/v1/skill-groups` : groupes publiés triés, chacun avec ses `skills` publiés
  triés, en au plus deux requêtes (pas de N+1).
- **Fichiers** : dossiers `skill-groups`, `apps/api/test/skill-groups.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : 7 groupes validés par `SkillGroupSchema` ; un groupe non publié disparaît avec ses compétences ; test unitaire du dépôt comptant les requêtes exécutées ≤ 2 (logger Drizzle de test injecté via un `DrizzleDatabaseClient` de doublure).

### L3-05 (A) — Module `experiences` (skills, enums, tri par date)

- **Description** : `GET /api/v1/experiences` : tri `date_start desc`, `achievements` en tableau, `skills`
  imbriqués triés par `experience_skills.sort_order`, dates au format `YYYY-MM-DD`, `logo` null si pas de
  `logo_path`.
- **Fichiers** : dossiers `experiences`, `apps/api/test/experiences.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : 8 éléments validés par `ExperienceSchema` ; le premier est le plus récent ; l'élément `kind: 'break'` a `company: null` et `stackLabel` « Huile de coude » ; `?lang=en` renvoie les `achievements` anglais ; repli vers `fr` vérifié sur une expérience sans `en`.

### L3-06 (A) — Module `languages`

- **Description** : `GET /api/v1/languages`.
- **Fichiers** : dossiers `languages`, `apps/api/test/languages.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : 2 éléments validés par `LanguageSchema` ; `cefrLevel` `C1` pour `en`, null pour `fr`.

### L3-07 — Route du contrat OpenAPI — livré au lot 0 (`8eadf96`)

- **Statut** : déjà livré par L0-03 sous la forme de `GET /api/v1/docs.json` (`DocsModule`,
  `cache-control: public, max-age=300`, document généré par `createOpenApiDocument()` de
  `@siteperso/contracts`). Méta-route hors `paths` du document. Aucune action au lot 3 : la route reflète
  automatiquement les chemins ajoutés au lot 2. Le numéro est conservé pour la traçabilité ; l'agent A n'a pas
  de septième module.
- **Critères d'acceptation** (lot 4, L4-06) : `GET /api/v1/docs.json` strictement égal (`deepEqual`) au
  contenu de `packages/contracts/dist/openapi.json` après `pnpm build`.

### L3-08 (B) — Module `projects` (skills imbriqués)

- **Description** : `GET /api/v1/projects`, `skills` via `project_skills`, images en `ImageSchema | null`.
- **Fichiers** : dossiers `projects`, `apps/api/test/projects.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : 200 et `[]` sur la base seedée ; avec une fixture insérée dans le test (projet + 2 skills, `en` absent) : 1 élément validé par `ProjectSchema`, `skills` triés, repli `fr` sur `?lang=en`.

### L3-09 (B) — Module `tools`

- **Description** : `GET /api/v1/tools`.
- **Fichiers** : dossiers `tools`, `apps/api/test/tools.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : `[]` sur base seedée ; avec fixture : validé par `ToolSchema`, filtrage `published`, tri.

### L3-10 (B) — Module `resources`

- **Description** : `GET /api/v1/resources`, `groupSlug` résolu par jointure sur `skill_groups` (null si
  pas de groupe).
- **Fichiers** : dossiers `resources`, `apps/api/test/resources.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : `[]` sur base seedée ; avec fixture rattachée à un groupe : `groupSlug` renseigné ; sans groupe : null.

### L3-11 (B) — Module `certifications`

- **Description** : `GET /api/v1/certifications`.
- **Fichiers** : dossiers `certifications`, `apps/api/test/certifications.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : 3 éléments validés par `CertificationSchema`, tri `sort_order`, `en` présent et repli testé.

### L3-12 (B) — Module `education`

- **Description** : `GET /api/v1/education`.
- **Fichiers** : dossiers `education`, `apps/api/test/education.e2e-spec.ts`.
- **Critères d'acceptation** :
  - e2e : ≥ 1 élément validé par `EducationSchema`, `yearEnd` null accepté.

### L3-13 (B) — Module `cv` (agrégat)

- **Description** : `GET /api/v1/cv` : `GetCvUseCase` (`src/application/cv/get-cv.use-case.ts`) compose les
  10 cas d'usage listés, reçus par constructeur ; `CvModule` importe les 10 modules de ressources et fournit
  `GetCvUseCase` par `useFactory` + `inject: [GetProfileUseCase, …]` (noms de classes fixés ci-dessus),
  exécution en parallèle (`Promise.all`), réponse validée par `CvSchema` strict, `locale` effective dans le
  corps. Aucun dépôt propre : `cv` ne duplique aucune requête (`CLAUDE.md`). Tests unitaires avec des
  doublures des cas d'usage (l'agent B n'attend pas le code de l'agent A) ; test e2e exécutable seulement
  après fusion des deux branches : le chef de projet le lance à l'intégration.
- **Fichiers** : `apps/api/src/application/cv/**`, `apps/api/src/infrastructure/http/cv/**`, `apps/api/test/cv.e2e-spec.ts`.
- **Critères d'acceptation** :
  - Unitaire : `GetCvUseCase` renvoie un objet validé par `CvSchema` à partir de doublures ; une doublure qui rejette fait rejeter l'ensemble (pas de réponse partielle).
  - e2e (après fusion A + B) : `GET /api/v1/cv` → 200, validé par `CvSchema` ; `cv.experiences` égal à la réponse de `/experiences` ; `?lang=en` → `locale: 'en'`.
  - Temps de réponse de `/cv` sur base seedée < 200 ms en local (mesuré dans le test e2e, seuil indicatif).

### L3-14 (A et B) — Comptes rendus

- **Description** : chaque agent livre `docs/comptes-rendus/lot-3-dev-api-{a,b}.md`, avec la liste des
  changements partagés demandés à l'orchestrateur (exports, contrats, schéma).
- **Critères d'acceptation** : critères D1 à D10 sur chaque branche ; `git diff --stat develop..lot/3-api-a` et `...lot/3-api-b` ne listent aucun fichier commun (périmètres disjoints vérifiés par `comm -12`) ; `pnpm check` vert sur `develop` après fusion des deux branches et des commits partagés de l'orchestrateur.

---

## 5. Lot 4 — QA

- **Objectif** : une suite e2e exhaustive et reproductible contre le Postgres Docker de test, couvrant
  chaque endpoint dans les deux langues, le repli, les erreurs, la sécurité HTTP et la conformité des
  réponses au document OpenAPI, plus les tests unitaires manquants.
- **Dépendances** : lot 3 (A et B) fusionné.
- **Agent responsable** : QA (branche `lot/4-qa`).
- **Périmètre autorisé** : `apps/api/test/**`, `apps/api/src/**/*.spec.ts`, `apps/api/vitest.config.ts`,
  `apps/api/vitest.e2e.config.ts`, `apps/api/package.json` (dépendances de test uniquement),
  `docs/comptes-rendus/lot-4-*.md`. Les bugs trouvés sont consignés (pas corrigés par la QA sauf trivialité
  dans un test) et transmis au lot 6.

### L4-01 — Harnais e2e commun

- **Description** : compléter `apps/api/test/support/` : `fixtures.ts` (`withFixture()` : insertion via
  `openTestSql()` puis nettoyage en fin de test), `problem.ts` (`expectProblem(res, status)` : vérifie
  `content-type` et `ProblemDetailsSchema`), `validate.ts` (`validate(schema, body)` strict), `endpoints.ts`
  (table `ENDPOINTS` : 12 routes, schéma associé, compteur attendu sur base seedée). `startTestApp()` et
  `resetTestDatabase()` existent déjà.
- **Fichiers** : `apps/api/test/support/{fixtures.ts,problem.ts,validate.ts,endpoints.ts}`.
- **Critères d'acceptation** :
  - `pnpm test:e2e` passe deux fois de suite sans intervention (reproductibilité).

### L4-02 — Matrice endpoints × langues × repli

- **Description** : test paramétré sur `ENDPOINTS` : pour chaque route, `sans lang` = `fr`, `?lang=fr`,
  `?lang=en`, `?lang=EN` → 400 (point ouvert P8 : contrat strict `fr|en` minuscule), `?lang=de` → 400,
  `?lang=` → 400 ; repli : suppression de toutes les lignes `en` de la table concernée dans la fixture puis
  `?lang=en` égal à `?lang=fr` champ par champ.
- **Fichiers** : `apps/api/test/matrix.e2e-spec.ts`.
- **Critères d'acceptation** :
  - Le test couvre les 12 routes (assertion `expect(ENDPOINTS).toHaveLength(12)`), passe, et le rapport Vitest liste ≥ 72 cas (12 × 6).

### L4-03 — Filtrage `published` et tri

- **Description** : pour chaque ressource en liste : une fixture non publiée n'apparaît ni dans la route
  dédiée ni dans `/cv` ; un `sort_order` modifié change l'ordre ; `experiences` triées `dateStart desc`.
- **Fichiers** : `apps/api/test/published-and-order.e2e-spec.ts`.
- **Critères d'acceptation** : passe ; 10 ressources en liste couvertes.

### L4-04 — Erreurs et routes

- **Description** : compléter `errors.e2e-spec.ts` (qui perd ses 12 cas en 501) : 404 problem+json sur
  `/api/v1/inconnu`, `/api/v1/profile/1`, `/inconnu`, `/api/v2/cv` ; 405 ou 404 (selon Fastify, à consigner)
  sur `POST /api/v1/profile` ; `HEAD` et `OPTIONS` cohérents ; corps d'erreur sans stack trace ni message
  interne (`detail` générique en 500 simulé via une doublure de dépôt qui lève, montée par
  `Test.createTestingModule` avec `overrideProvider(<RESOURCE>_REPOSITORY)`) ; `instance` = chemin demandé.
- **Fichiers** : `apps/api/test/errors.e2e-spec.ts`.
- **Critères d'acceptation** : passe ; aucune réponse d'erreur ne contient `at ` suivi d'un chemin de fichier (`/apps/api/`) ; `grep -c 501 apps/api/test/errors.e2e-spec.ts` = 0.

### L4-05 — En-têtes de sécurité, CORS, rate limiting

- **Description** : sur chaque route : `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`
  (livré ; `DENY` si Julien tranche P9), `referrer-policy`, `strict-transport-security`, absence de
  `x-powered-by` et de `server` détaillé ; pas de `content-security-policy` attendue (choix du lot 0 : API
  JSON ; si P9 impose une CSP, test à inverser) ; CORS : `Origin` = première valeur de `CORS_ORIGIN` →
  `access-control-allow-origin` égal, autre origine → absent ; préflight `OPTIONS` n'autorise que
  `GET`/`HEAD` ; rate limiting : avec `RATE_LIMIT_MAX=3` injecté dans l'environnement de l'application de
  test (`createApp` lit `process.env` : surcharger avant `startTestApp()` dans un fichier dédié), la 4e
  requête dans la fenêtre → 429 problem+json avec `retry-after`. `health.e2e-spec.ts` et
  `rate-limit.e2e-spec.ts` du lot 0 sont fusionnés ou conservés sans doublon.
- **Fichiers** : `apps/api/test/security.e2e-spec.ts`.
- **Critères d'acceptation** : passe ; `curl -s -I -H "Origin: https://evil.example" http://localhost:3000/api/v1/health | grep -i access-control-allow-origin` vide.

### L4-06 — Conformité des réponses au document OpenAPI

- **Description** : pour chaque route et chaque langue, la réponse est validée (a) par le schéma Zod du
  contrat en mode strict et (b) par le schéma JSON correspondant extrait du document servi par
  `GET /api/v1/docs.json` (validation Ajv 2020-12 avec `additionalProperties` forcé à false ; dépendance de
  dev choisie avec `pnpm view`) ; les codes 400/404/429 sont déclarés dans le document pour la route ;
  `GET /api/v1/docs.json` égal (`deepEqual`) au contenu de `packages/contracts/dist/openapi.json`.
- **Fichiers** : `apps/api/test/openapi-conformance.e2e-spec.ts`.
- **Critères d'acceptation** : passe pour 12 routes × 2 langues ; un champ ajouté artificiellement dans une réponse (doublure) fait échouer le test (test négatif inclus).

### L4-07 — Tests unitaires manquants et seuil de couverture

- **Description** : compléter les unitaires des cas d'usage, du filtre problem+json (`toProblemDetails`), du
  parsing de config ; activer `coverage` (v8, `@vitest/coverage-v8` à la version de `vitest`) dans
  `vitest.config.ts` avec seuils `lines 85`, `branches 75` sur `apps/api/src` hors `infrastructure/db/schema`,
  `cli/` et `main.ts`.
- **Fichiers** : `apps/api/src/**/*.spec.ts`, `apps/api/vitest.config.ts`, `apps/api/package.json`.
- **Critères d'acceptation** : `pnpm --filter @siteperso/api test -- --coverage` passe avec les seuils.
- **Clos puis remplacé au lot 7 (19 nov. 2026)** : le périmètre réduit et les seuils 85/75 disparaissent ; couverture
  fusionnée unitaires + e2e (projets Vitest), seuil 100 % sur les quatre métriques, sans exclusion de
  production ni commentaire d'ignore, imposée par `pnpm test:coverage` dans `pnpm check` et en CI.

### L4-08 — Rapport QA

- **Description** : `docs/comptes-rendus/lot-4-qa.md` : liste des anomalies trouvées (gravité, route,
  reproduction par commande), cas non couverts, décisions (405 vs 404, `x-frame-options`, CSP).
- **Critères d'acceptation** : critères D1 à D10 ; chaque anomalie référence un test rouge ou `skip` nommé `BUG-<n>`.

---

## 6. Lot 5 — DevOps

- **Objectif** : image Docker de production, compose de production derrière Caddy (TLS automatique, aucun
  port base exposé), script de premier déploiement sur le VPS, CI GitHub Actions.
- **Dépendances** : lot 0 fusionné pour démarrer ; vérification finale après fusion du lot 4 (le service
  `migrate` a besoin du runner du lot 1 : L5-02 se termine après la fusion du lot 1).
- **Agent responsable** : DevOps (branche `lot/5-devops`).
- **Périmètre autorisé** : `docker/**`, `docker-compose.yml` (modifications minimales et justifiées :
  `name:`, service `api` sous profil), `scripts/**`, `.github/**`, `.dockerignore`, `docs/deploiement.md`,
  `docs/comptes-rendus/lot-5-*.md`.
- **Contraintes livrées au lot 0** : `.npmrc` `use-node-version=26.13.1` fait télécharger Node par pnpm ;
  dans l'image, utiliser `node:26.13.1-alpine` (même version) et neutraliser le téléchargement
  (`pnpm config set use-node-version` vide ou `--config.use-node-version=` au `pnpm install`). L'API lit
  `HOST`, `PORT`, `DATABASE_URL`, `CORS_ORIGIN`, `RATE_LIMIT_*`, `TRUST_PROXY` ; derrière Caddy,
  `TRUST_PROXY=uniquelocal` (lot 6 : `true` refusé) est obligatoire (sinon tout le trafic partage le quota de l'IP du proxy). `/health`
  renvoie 503 tant que la base est injoignable.

### L5-01 — Dockerfile multi-stage de l'API

- **Description** : `docker/api.Dockerfile` : étape `deps` (`node:26.13.1-alpine`, `corepack enable`, `pnpm
  install --frozen-lockfile`), `build` (`pnpm turbo run build --filter=@siteperso/api...`), `prune` (`pnpm
  deploy --filter=@siteperso/api --prod`), `runtime` (`node:26.13.1-alpine`, utilisateur non root `node`,
  `NODE_ENV=production`, `HOST=0.0.0.0`, copie de `apps/api/dist`, `node_modules` prunés et `db/`,
  `HEALTHCHECK` sur `/api/v1/health`, `CMD node dist/main.js`). `.dockerignore` strict. Image sans `pnpm`,
  sans sources TS, sans `.env`. Service optionnel `api` (profil `api`, `build` du Dockerfile, `depends_on`
  `postgres` healthy) ajouté à `docker-compose.yml` pour l'essai local, et `name: siteperso-v3` pour fixer le
  nom du réseau quel que soit le dossier.
- **Fichiers** : `docker/api.Dockerfile`, `.dockerignore`, `docker-compose.yml`.
- **Critères d'acceptation** :
  - `docker build -f docker/api.Dockerfile -t siteperso-api:test .` passe.
  - `docker run --rm siteperso-api:test sh -c 'id -u'` ≠ 0 ; `docker run --rm siteperso-api:test sh -c 'ls src 2>/dev/null; ls .env 2>/dev/null; which pnpm'` ne renvoie rien.
  - `docker image inspect siteperso-api:test --format '{{.Size}}'` < 300 Mo.
  - `pnpm db:up && docker compose --profile api up -d --build api && sleep 3 && curl -s http://127.0.0.1:3000/api/v1/health` = `{"status":"ok","checks":{"database":"up"}}` (base migrée au préalable avec `pnpm db:migrate` après fusion du lot 1 ; avant, 503 attendu).

### L5-02 — Compose de production avec Caddy

- **Description** : `docker/compose.prod.yml` (`name: siteperso-v3-prod`) : services `caddy` (ports 80/443,
  volumes `caddy_data`, `caddy_config`, `Caddyfile`), `api` (image construite, `expose: 3000` seulement,
  `TRUST_PROXY=uniquelocal`, `depends_on` `migrate` terminé avec succès et `postgres` healthy, `restart:
  unless-stopped`), `migrate` (même image, commande `node dist/cli/migrate.js && node dist/cli/seed.js`,
  `restart: no`), `postgres` (`postgres:16-alpine`, volume nommé, aucun port publié, healthcheck), réseau
  interne. `web` : service réservé (commenté ou image placeholder statique) en attendant le front.
  `docker/Caddyfile` : site `{$SITE_DOMAIN}`, `reverse_proxy /api/* api:3000`, `encode gzip zstd`,
  en-têtes de sécurité complémentaires, `/` renvoie une page statique minimale sans donnée personnelle tant
  que le front n'existe pas. Variables dans `docker/.env.prod.example` (placeholders : `SITE_DOMAIN`,
  `POSTGRES_PASSWORD`, `CORS_ORIGIN`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`).
- **Fichiers** : `docker/compose.prod.yml`, `docker/Caddyfile`, `docker/.env.prod.example`, `docker/placeholder/index.html`.
- **Critères d'acceptation** :
  - `docker compose -f docker/compose.prod.yml --env-file docker/.env.prod.example config` passe.
  - `docker compose -f docker/compose.prod.yml --env-file docker/.env.prod.example config | grep -A3 'postgres:' | grep -c 'ports:'` = 0 (aucun port base exposé) ; seul `caddy` publie des ports.
  - `docker run --rm -v "$PWD/docker/Caddyfile:/etc/caddy/Caddyfile" caddy:2 caddy validate --config /etc/caddy/Caddyfile` passe.
  - Test local (après fusion du lot 1) : `SITE_DOMAIN=localhost docker compose -f docker/compose.prod.yml --env-file docker/.env.prod.example up -d --build` puis `curl -sk https://localhost/api/v1/health` = `{"status":"ok","checks":{"database":"up"}}` ; après fusion du lot 3, `curl -sk https://localhost/api/v1/cv` validé par `CvSchema` (migrations et seeds passés par le service `migrate`).

### L5-03 — Script de premier déploiement VPS

- **Description** : `scripts/deploy/first-install.sh` (bash, `set -euo pipefail`, idempotent) : vérifie
  Docker et Compose, crée le dossier de déploiement, copie `.env.prod.example` en `.env.prod` si absent et
  s'arrête pour que l'opérateur le remplisse (mots de passe générés par `openssl rand`), construit ou tire
  l'image, lance `compose.prod.yml`, attend le healthcheck, affiche l'état. `scripts/deploy/update.sh` :
  `git pull`, rebuild, `up -d`, `migrate` relancé. `scripts/deploy/backup.sh` : `pg_dump` via `docker compose
  exec`. Aucun secret dans le repo. `docs/deploiement.md` décrit la procédure et la sauvegarde/restauration.
- **Fichiers** : `scripts/deploy/{first-install.sh,update.sh,backup.sh}`, `docs/deploiement.md`.
- **Critères d'acceptation** :
  - `bash -n scripts/deploy/*.sh` et `docker run --rm -v "$PWD:/mnt" koalaman/shellcheck:stable scripts/deploy/*.sh` passent.
  - Exécution à blanc sur l'hôte avec `DEPLOY_DIR=$(mktemp -d)` : le script s'arrête proprement à l'étape « remplir .env.prod » avec un code de sortie documenté, puis termine sur une seconde exécution avec un `.env.prod` rempli de valeurs de test.
  - Critère D7 sur `scripts/` et `docs/deploiement.md`.

### L5-04 — CI GitHub Actions

- **Description** : `.github/workflows/ci.yml` déclenché sur `push` et `pull_request` : job `qualite`
  (`pnpm/action-setup` lisant `packageManager`, Node via `.npmrc` `use-node-version` ou
  `actions/setup-node` 26.13.1 avec cache pnpm, `pnpm install --frozen-lockfile`, `pnpm format:check`,
  `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`), job `e2e` (service `postgres:16-alpine` avec
  base `siteperso_test`, `DATABASE_URL` pointant dessus, `CORS_ORIGIN` de test, `pnpm test:e2e`), job
  `docker` (`docker build -f docker/api.Dockerfile`, sans push). Concurrence annulant les runs obsolètes,
  permissions minimales (`contents: read`), actions épinglées par tag majeur.
- **Fichiers** : `.github/workflows/ci.yml`.
- **Critères d'acceptation** :
  - `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest` passe.
  - Exécution locale équivalente des trois jobs (commandes listées dans le compte rendu) passe.
  - `grep -c "permissions:" .github/workflows/ci.yml` ≥ 1 et aucune étape `push` d'image ni secret référencé.

### L5-05 — Vérification finale et compte rendu

- **Description** : après fusion du lot 4, rejouer L5-01 à L5-04 sur `develop`, puis
  `docs/comptes-rendus/lot-5-devops.md`.
- **Critères d'acceptation** : critères D1 à D10 ; `docker compose -f docker/compose.prod.yml ... down -v` laisse `docker ps -a | grep siteperso-v3-prod` vide.

---

## 7. Lot 6 — Revues indépendantes, corrections, recette

- **Objectif** : deux relectures adversariales du diff complet `master..develop` (code et sécurité),
  menées sans connaître les conclusions l'une de l'autre, des findings vérifiés puis corrigés, et une
  recette finale par le chef de projet.
- **Dépendances** : lots 4 et 5 fusionnés.
- **Agents responsables** : Revue code, Revue sécurité (lecture seule, en parallèle), Agent corrections
  (branche `lot/6-corrections`), Chef de projet (recette).
- **Périmètre autorisé** : revues → `docs/revues/**` uniquement ; corrections → tout le repo sauf `docs/0*.md`
  et `docs/backlog.md`.

### L6-01 — Revue de code indépendante

- **Description** : relecture de `git diff master..develop` : respect de l'architecture hexagonale par
  couches (`CLAUDE.md`), duplication entre modules A et B (parsing de `?lang`, jointures de traduction :
  proposer un helper partagé si la duplication le justifie), gestion d'erreurs, N+1, typage (`any`,
  assertions), dette, lisibilité, pertinence des tests. Chaque finding : fichier, ligne, gravité (bloquant /
  majeur / mineur), scénario de défaillance, proposition. Sans accès à `docs/revues/securite-*.md`.
- **Fichiers** : `docs/revues/code-2026-11-<jj>.md`.
- **Critères d'acceptation** : fichier présent, chaque finding a un identifiant `RC-<n>` et une commande ou un test de reproduction ; `git diff --stat` de la branche de revue ne liste que `docs/revues/`.

### L6-02 — Revue de sécurité indépendante

- **Description** : même diff, angle sécurité : injection SQL (requêtes Drizzle paramétrées, pas de `sql.raw`
  sur entrée utilisateur), validation de `lang`, fuite d'informations (stack, versions, `server`),
  en-têtes, CORS, rate limiting (`TRUST_PROXY` en prod), Dockerfile (utilisateur, surface), compose prod
  (ports, secrets, réseau), scripts de déploiement (`set -euo pipefail`, injection via variables), CI
  (permissions, épinglage), dépendances (`pnpm audit --prod`), données personnelles (grep e-mail/téléphone),
  absence d'endpoints d'écriture. Sans accès à `docs/revues/code-*.md`.
- **Fichiers** : `docs/revues/securite-2026-11-<jj>.md`.
- **Critères d'acceptation** : fichier présent, findings `RS-<n>` avec gravité et reproduction ; `pnpm audit --prod --audit-level=high` exécuté et son résultat consigné.

### L6-03 — Vérification et triage des findings

- **Description** : le chef de projet (ou un agent dédié) rejoue chaque reproduction, classe les findings
  (confirmé / non reproduit / faux positif), fusionne les doublons RC/RS et produit la liste de corrections
  ordonnée par gravité dans `docs/revues/triage-2026-11-<jj>.md`.
- **Critères d'acceptation** : chaque finding RC/RS apparaît dans le triage avec un statut ; les bloquants et majeurs confirmés ont un ticket `L6-04-<n>`.

### L6-04 — Corrections

- **Description** : un commit par finding confirmé (`fix(<scope>): RC-3 …`), avec test de non-régression
  quand un test est possible ; les mineurs non corrigés sont consignés comme dette dans le compte rendu.
- **Fichiers** : selon findings ; `docs/comptes-rendus/lot-6-corrections.md`.
- **Critères d'acceptation** : critères D1 à D10 ; `git log --oneline develop..lot/6-corrections | grep -cE "RC-|RS-"` = nombre de findings confirmés bloquants + majeurs ; tous les tests `BUG-<n>` du lot 4 passent (plus aucun `skip`).

### L6-05 — Recette finale du chef de projet

- **Description** : sur `develop` après fusion, depuis un clone propre : `pnpm install --frozen-lockfile`,
  `pnpm db:up && pnpm db:migrate && pnpm db:seed`, `pnpm build`, `pnpm check`, `pnpm dev` + curl des 13
  routes et de `/docs.json`, L5-02 (compose prod local), relecture de `docs/traductions-a-relire.md`, puis
  rédaction de `docs/compte-rendu-2026-11-<jj>.md` : périmètre livré, écarts avec `docs/01` et `docs/02`,
  dette, points ouverts pour Julien, coût (tokens / durée si connus).
- **Critères d'acceptation** :
  - Séquence complète verte depuis un clone propre ; `git status --porcelain` vide ensuite.
  - `docs/compte-rendu-2026-11-<jj>.md` présent avec les sections « Livré », « Non livré », « Décisions », « Points ouverts », « Dette ».
  - Point de contrôle 2 : attente de Julien.

---

## 7 bis. Lot 7 — Couverture de test à 100 % (LIVRÉ le 19 nov. 2026)

- **Décision de Julien** : couverture 100 % (lignes, branches, fonctions, instructions) de toute la base,
  unitaires + e2e cumulés, sans exclusion de production ni commentaire d'ignore ; le code jamais exécuté se
  supprime. Détail : `docs/comptes-rendus/lot-7-couverture.md`.
- **Livré** : projets Vitest `unit` et `e2e` dans la configuration Vitest de l'API, couverture v8 fusionnée
  avec seuils 100 sur les deux paquets, `pnpm test:coverage` (Turborepo, dans `pnpm check` et dans le job
  e2e de la CI avec résumé et artefact lcov), 776 tests API et 104 tests contrats.

## 7 ter. Lot 8 — Agents spécialisés et garde-fous (LIVRÉ le 19 nov. 2026)

- **Livré** : onze agents dans `.claude/agents/` (lead-architecte, chef-de-projet, dev-sql, dev-contrats,
  dev-api, dev-devops, qa, revue-code, revue-securite, triage, correcteur) ; hooks de `.claude/settings.json`
  (`.claude/hooks/`, 30 tests, `pnpm hooks:test`) qui refusent la modification des oracles (tests existants,
  configurations de test et de CI, marqueurs de saut, commentaires d'ignore) et comparent les empreintes en
  fin de tâche ; exception nominative journalisée (`authorize.mjs`, `audit.log`) ; script
  `scripts/ci/check-tests-integrity.sh` (19 cas, job CI, `pnpm integrity` dans `pnpm check`).
- **Règle Justification-test** : tout commit qui modifie ou supprime un test existant, ajoute un test en
  échec attendu ou change une configuration protégée porte `Justification-test: <finding> <raison>` ;
  la CI refuse sinon. **Sortie honorable** : un test impossible, contradictoire ou faux s'arrête, se
  consigne, se décide par l'orchestrateur. Détail : `docs/comptes-rendus/lot-8-agents.md`, `CLAUDE.md`.
- **Tranché par Julien le 19 nov. 2026 (acceptés)** : portée `config` accordée aussi à lead-architecte et
  dev-devops ; marqueur `fails` admis pour la qa sous autorisation et Justification-test.

## 7 quater. Lots 9 à 12 (LIVRÉS le 19 nov. 2026)

Synthèse dans `docs/lots.md`, détail dans `docs/comptes-rendus/lot-9-*.md` à `lot-12-*.md`.

## 7 quinquies. Lot 13 — Git flow (tranché par Julien le 19 nov. 2026)

- **Décision de Julien** : le dépôt adopte git flow. `develop` remplace l'ancienne branche d'intégration
  (renommée ; les sections des lots précédents la citent sous ce nom) comme branche d'intégration
  permanente. Les lots restent des branches `lot/N-nom` créées depuis `develop` et fusionnées en `--no-ff`
  par l'orchestrateur. La session principale (rôle `main` des hooks) peut pousser `develop`, et uniquement
  `develop`, vers `origin` ; les onze agents spécialisés n'ont aucun droit de push. **Réservé à Julien** :
  toute fusion dans `main` (branches `release/*` et `hotfix/*`), les étiquettes de version, le push de
  `main` et le lancement du déploiement. Aucune session ni aucun agent ne pousse `main`, ne crée ni ne
  pousse d'étiquette, ne supprime de branche distante, ne force un push.
- **Agent** : lead-architecte (branche `lot/13-git-flow`, autorisation `config`, ticket GITFLOW).
- **L13-01** : hooks (`.claude/hooks/lib/shell.mjs`) : `git push` permis à la seule session principale,
  sous la forme `git push [-u|--set-upstream] origin develop[:develop]` (options globales `-C` et `-c`
  ordinaires admises) ; tout le reste refusé avec son motif (agent, autre remote, autre branche ou refspec,
  push forcé, suppression, `--all`, `--mirror`, `--tags`, `--prune`, `--push-option`, refspec absente,
  plusieurs refspecs, configuration ou variable qui change la destination, alias, push dans du code
  opaque). Tests : `.claude/hooks/tests/git-push.test.mjs`.
- **L13-02** : `.claude/settings.json` : le refus de tout `git push` remplacé par des refus en motif des
  variantes dangereuses ; l'autorité reste le hook.
- **L13-03** : `scripts/ci/check-tests-integrity.sh` : base par défaut `origin/develop`, sinon `develop` ;
  test `scripts/ci/tests/default-base.test.sh`.
- **L13-04** : CI : déclencheurs `push` sur `develop`, `main`, `release/**`, `hotfix/**`, `lot/**` et
  `pull_request` ; base d'intégrité hors PR `develop`.
- **L13-05** : déploiement : `scripts/deploy/update.sh` tire `origin main` ; `first-install.sh` et
  `update.sh` refusent un dépôt qui n'est pas sur `main` (`docs/deploiement.md`, « Branche déployée »).
- **L13-06** : documentation : `CLAUDE.md`, `docs/03-organisation-agents.md`, ce backlog.
- **Réglages GitHub à faire par Julien** : branche par défaut `develop` ; protection de `main` (fusion par
  pull request, relecture, pas de push direct ni forcé, pas de suppression) ; suppression de l'ancienne
  branche d'intégration distante.
- **Critères d'acceptation** : `pnpm hooks:test`, `pnpm integrity:test`, `pnpm integrity develop` et
  `pnpm check` verts ; aucune mention de l'ancienne branche hors historiques (`docs/comptes-rendus/`,
  `docs/revues/`, `docs/lots.md`). Compte rendu : `docs/comptes-rendus/lot-13-git-flow.md`.

## 7 sexies. Lot 14 — Suites de la recette du lot 12, mutation incrémentale (tranché par Julien le 19 nov. 2026, après le lot 13 bis)

Quatre questions fermées remontées par la recette du lot 12, toutes tranchées **oui** par Julien :

- **L14-01** (lead-architecte, portée `config`) : les hooks bloquent dès l'écriture toute directive
  `Stryker disable` qui ne cite pas un identifiant d'équivalent déclaré, comme ils bloquent déjà les
  marqueurs de saut de Vitest ; aujourd'hui seul `scripts/ci/check-tests-integrity.sh` la refuse, au commit
  et en CI. Tests dans `.claude/hooks/tests/`.
- **L14-02** (lead-architecte, portée `config`) : le contrôle Justification-test des directives passe du
  fichier à la ligne : la justification d'un commit cite l'identifiant de chaque directive ajoutée, et cet
  identifiant pointe sur la ligne et le mutateur déclarés dans le fichier d'équivalents. Ferme le trou
  constaté en recette (directive glissée dans un fichier qu'un commit justifié touche déjà).
- **L14-03** (dev-devops, portée `config`) : **tranché par Julien le 19 nov. 2026 après mesure**. Premier
  run complet de la CI sur `main` : 35 min (dépôt privé, job mutation probablement limitant, timeout 45 min).
  Décision : sur `develop` (et les PR vers `develop`), le job mutation passe en **mode incrémental** de
  Stryker (`--incremental`, fichier d'incrément conservé entre les runs par le cache GitHub Actions) ; un
  run **complet**, seuils de rupture compris, n'a lieu que sur les **étiquettes de version** (`v*`), au
  moment de la release vers `main`. Déclencheur `tags: ['v*']` à ajouter à la CI.
  Décidé par Julien le 20 nov. 2026 : le relèvement du `break` de l'API de 40 à 42 (scores du lot 15 de
  42,03 à 42,89 % selon les timeouts) se tranche dans ce ticket, une fois la mesure stabilisée.
- **L14-05** (plus tard, après la phase front) : **déploiement par étiquette**, décidé par Julien le
  19 nov. 2026. Chaque nouvelle étiquette `v*` posée par Julien déclenche un job CI qui déploie cette
  étiquette en production. Aujourd'hui les scripts de `scripts/deploy/` déploient `main` et refusent une
  HEAD détachée (lot 13) : ils passeront à « l'étiquette demandée, qui doit être atteignable depuis
  `main` ». Rien à configurer avant la fin du front.
- **L14-06** (lead-architecte, portée `config`), décidé par Julien le 19 nov. 2026 après la recette du
  lot 13 bis : les hooks refusent à toute session et à tout agent d'écrire la branche locale `main`
  (merge, commit, reset, rebase, cherry-pick quand HEAD est `main` ; `git branch -f main`,
  `git update-ref refs/heads/main`, `checkout -B main`) : une écriture locale sur `main` se retrouverait
  dans le prochain push de Julien. Restent permis, par décision du même jour : l'étiquette locale
  (`git tag`, son push étant refusé) et le déplacement local de `develop` (`branch -f`, `update-ref`,
  `checkout -B`), le push ne pouvant viser que `develop` et jamais en force. À revoir à l'usage.
- **L14-07** (lead-architecte) : le test « commandes ordinaires » des hooks reçoit un échantillon des
  88 commandes de l'orchestrateur rejouées en recette du lot 13 bis (une règle plus stricte ne doit pas
  casser le travail courant), et le rejeu des refus de push couvre tous les rôles d'agent, pas
  seulement `dev-api`.
- **L14-08** (dev-devops, portée `config`), décidé par Julien le 20 nov. 2026 : **actionlint** valide
  les workflows GitHub (syntaxe, expressions, déclencheurs, épinglages, scripts `run:` par shellcheck)
  dans `pnpm check` et dans un job CI, lancé par Docker avec une image épinglée par digest (rien installé
  sur l'hôte), en remplacement de la validation de l'extension VS Code GitHub Actions, désactivée par
  Julien sur ce projet : elle signalait à tort « Unable to resolve action » sur des SHA pourtant
  vérifiés (commit, étiquette et `action.yml` servis par GitHub). Un workflow invalide est alors
  refusé avant le push.
- **L14-09** (lead-architecte, portée `config`), décidé par Julien le 20 nov. 2026 : le **formatage** est
  vérifié avant le push, plus seulement en CI. `pnpm format:check` entre dans `pnpm check`, et le hook
  pre-commit vérifie Prettier sur les seuls fichiers indexés (rapide). Aujourd'hui un fichier mal
  formaté passe en local et ne casse qu'au job « Qualité » de GitHub.
- **L14-10** (dev-devops, portée `config`), décidé par Julien le 20 nov. 2026 : **shellcheck** analyse
  les scripts shell du dépôt (`scripts/**/*.sh`, `.claude/hooks/run.sh`, `.husky/pre-commit`), dans
  `pnpm check` et dans un job CI, lancé par Docker avec une image épinglée par digest, comme actionlint
  (L14-08). Les avertissements existants sont corrigés, ou justifiés ligne par ligne par une directive
  `# shellcheck disable=SCxxxx` commentée.
- **L14-04** (correcteur, en phase 3 du test par mutation) : garde `response !== null` dans `detailOf`
  (`problem-details.ts`), avec son test ; aujourd'hui `'message' in null` lèverait une TypeError dans le
  filtre global, cas inatteignable par les clients mais défaut latent.
- **L14-11** (lead-architecte, portée `config`), décidé par Julien le 20 nov. 2026 (recette du lot 16,
  point ouvert 2) : un marqueur interdit suivi de plusieurs méthodes de l'API de test (un saut, puis
  `concurrent`, puis `each`, par exemple) est reconnu par les hooks (`MARKER_RE`) comme par le script
  d'intégrité (`FORBIDDEN_RE`, `FAILS_RE`). Tests à côté des tests existants des hooks et du script ;
  comparaison de l'ancien et du nouveau sur toutes les formes, comme au lot 16 : aucune forme refusée
  aujourd'hui ne devient acceptée.
- **L14-12** (lead-architecte, portée `config`), même décision (point ouvert 3) : un fichier qui devient
  test ou oracle en cours de session (élargissement de la politique) est protégé dès ce moment par
  `checkFileTool` : le modifier exige une autorisation, comme un test existant, au lieu d'être rattrapé
  seulement au commit par la CI.
- **L14-13** (lead-architecte, portée `config`), même décision (point ouvert 1) : les hooks refusent aux
  agents spécialisés `git worktree prune` et `git worktree remove --force` (`-f`), qui font disparaître
  sans violation l'instantané d'un worktree (BF-11), et par cohérence tout `git worktree remove` ou
  `move` : un agent ne gère pas les worktrees, l'orchestrateur les lui fournit. La session principale
  garde ces commandes (ménage après fusion ; le `.env` non suivi d'un worktree impose la force).
- **L14-14** (lead-architecte), décidé par Julien le 20 nov. 2026 (« cadrer les agents
  correctement ») : chaque fichier `.claude/agents/*.md` reçoit une même section courte « Git et
  garde-fous » : ce que l'agent fait (commits atomiques sur la branche et dans le worktree fournis, hook
  pre-commit jamais contourné, compte rendu), ce qui lui est refusé (push, fusion, écriture de `main`,
  étiquette, `git stash` nu, `--no-verify`, gestion des worktrees, scripts de garde-fous et
  autorisations) et la conduite face à un refus (ne pas reformuler la commande pour passer : sortie
  honorable, consignée au compte rendu). La section énonce les règles sans décrire le fonctionnement des
  détections (rien d'exploitable dans des fichiers destinés à devenir publics). Un test des hooks
  vérifie que les quatorze fichiers portent la section, à l'identique, et qu'elle concorde avec les
  refus effectifs des hooks.
- **L14-15** (dev-api pour `apps/api/test/support/`, autorisation `tests` ; lead-architecte pour
  `apps/api/vitest.config.ts`, autorisation `config`), décidé par Julien le 20 nov. 2026, **prioritaire** :
  e2e de l'API plus rapides sans toucher aux oracles. Mesure du 20 nov. sur 71ff6b5 : 280 s, dont environ
  156 s pour 184 tests qui partent d'une base recréée (schéma vidé, 16 migrations, seeds : environ 1 s,
  83 appels dont 13 en `beforeEach`), et fichiers en série (`fileParallelism: false`, une seule base).
  1) base modèle migrée et seedée une fois par run (`globalSetup`), chaque remise à zéro la recopie au
  lieu de tout rejouer ; les tests des seeds et des migrations rejouent toujours les vrais fichiers ;
  2) une base par processus Vitest, puis fichiers en parallèle. Aucun fichier `*.e2e-spec.ts` modifié ;
  un test prouve qu'une base recopiée est identique à une base migrée et seedée (schéma et données) ;
  mêmes tests, mêmes résultats, couverture inchangée ; durées avant et après au compte rendu. Prépare la
  phase 3 de la mutation (une base par processus Stryker).
- **L14-16** (lead-architecte, portée `config`), même décision, **prioritaire** : `pnpm check` exécute
  une seule fois les unitaires et les e2e de l'API : `test:coverage` les rejoue déjà tous, en une passe
  fusionnée ; les parcours Playwright du front, hors couverture, restent lancés. Côté orchestrateur :
  pas de nouveau `pnpm check` avant le push quand l'arbre fusionné (`git rev-parse <commit>^{tree}`)
  est identique à celui que la recette a vérifié sans cache.
- **Décisions de Julien du 20 nov. 2026 sur les écarts de la branche des garde-fous**
  (`docs/comptes-rendus/lot-14-hooks-lead.md`) :
  - L14-06, commit sur `main` : le correcteur passe sur `develop` le dépôt temporaire du test
    « accepte les commandes ordinaires » (`guard.test.mjs`), qui le créait sur `main`, puis le
    lead-architecte ajoute le refus du commit quand HEAD est `main` ;
  - L14-02, citation de l'identifiant : le correcteur met à jour les deux tests qui acceptaient une
    justification sans l'identifiant de l'équivalent (`stryker-disable.test.mjs`,
    `stryker-disable.test.sh`), puis le lead-architecte exige l'identifiant cité et le mutateur déclaré ;
  - limites acceptées : la suppression du dossier d'un worktree efface son instantané sans
    violation (les commits restent contrôlés par `pnpm integrity`, en CI et en recette) ; pas de règles
    `permissions.deny` dans `.claude/settings.json` en doublon des hooks.
- **L14-17** (lead-architecte, portée `config`), décidé par Julien le 20 nov. 2026 : `git branch -u` et
  `--set-upstream-to`, qui écrivent `branch.*.remote` hors de la règle des destinations de push du lot
  13 bis, sont refusés aux agents spécialisés.
- **Ordre** : le lot 14 touche les hooks et la CI, que `docs/05-front-organisation.md` laissait à la
  session front pendant F0. F0, F1 bis (qui a touché `turbo.json`) et le lot 15 sont fusionnés le
  20 nov. 2026 : le lot est **débloqué**. Décision de Julien du 20 nov. : optimisations d'abord, travail
  en parallèle. Branche `lot/14-garde-fous-ci` : a) dev-api, L14-15 (support des e2e) ; b)
  lead-architecte, L14-15 (configuration), L14-16, L14-09 (script `check`, pre-commit) ; c) dev-devops,
  L14-03, 08, 10 (CI, actionlint, shellcheck ; touchent aussi le script `check`, donc après b). En
  parallèle, branche `lot/14-hooks` : lead-architecte, L14-01, 02, 06, 07, 11, 12, 13, 14 (hooks, script
  d'intégrité, fichiers d'agents), sans fichier commun avec l'autre branche. Recette du chef de projet
  sur les deux branches. L14-04 reste en phase 3 de la mutation, L14-05 après le front.
- **Recette du 20 nov. 2026** (`docs/comptes-rendus/lot-14-recette.md`, acceptée avec réserves) ;
  décisions de Julien du même jour :
  - seuil de mutation de l'API à **41** et non 42 (marge de 0,03 point trop mince selon la charge de
    l'exécuteur), à relever après le premier run complet sur une étiquette `v*` ;
  - la section « Git et garde-fous » des fichiers d'agents garde les gestes refusés nommés (`HUSKY=0`,
    `core.hooksPath`) ;
  - `pnpm check` à 369 s après F3a : chemin critique dans le front (`web#lint`, parcours), à traiter
    côté front (F11).

## 7 septies bis. Lot 18 — Suites de la recette du lot 14 (décidé par Julien le 20 nov. 2026)

- **L18-01** (lead-architecte, portée `config`) : la lecture `git config --get core.hooksPath` (et les
  autres lectures `git config --get`) est permise, comme le dit `CLAUDE.md` ; l'écriture reste refusée.
  Faux positif constaté en recette du lot 14.
- **L18-02** (lead-architecte, portée `config`) : `git branch --track` et la création d'une branche qui
  suit une branche distante (`git checkout -b|-B`, `git switch -c|-C`, `git branch` avec un point de
  départ distant, réglage `branch.autoSetupMerge`) sont refusés aux agents spécialisés, comme
  `git branch -u` (L14-17) ; la session principale les garde. Section « Git et garde-fous » et test de
  concordance mis à jour.
- Fusionné le 21 nov. 2026 (fef4db5), recette acceptée avec réserves (`docs/comptes-rendus/lot-18-recette.md`).
  Décision de Julien du même jour : `CLAUDE.md` garde ses détails sur les garde-fous (des règles, pas des
  mécanismes).

## 7 septies ter. Lot 19 — Trous confirmés par la recette du lot 18, charge machine (décidé par Julien le 21 nov. 2026)

- **L19-01** (lead-architecte, portée `config`) : la création ou l'écriture de la branche locale `main`
  par options collées (`git checkout -qb main`, `-bmain`, `git switch -cmain`, `--cr main` et formes
  voisines) est refusée à toutes les sessions, comme `checkout -b main` (L14-06), en réutilisant le
  lecteur d'options du lot 18.
- **L19-02** (lead-architecte, portée `config`) : `core.hooksPath` passé par l'environnement de git
  (`GIT_CONFIG_PARAMETERS`, `GIT_CONFIG_COUNT` avec `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n`) est
  refusé à toutes les sessions, comme `-c core.hooksPath=` ; une valeur illisible est refusée.
- **L19-03** (lead-architecte, portée `config`) : borne configurable du nombre de processus des e2e de
  l'API (et des tâches Vitest lourdes), transmise par Turborepo (`env` ou `passThroughEnv` des tâches
  concernées), lue dans le `.env` racine du worktree ; sans valeur, comportement actuel (cœurs moins
  un), en CI compris. Constat du 20 nov. : deux `pnpm check` simultanés (back et front) donnent des
  `HookTimeoutError` (charge 31 sur 16 cœurs).
- **L19-04** (lead-architecte, portée `config`, ajouté par Julien le 21 nov. 2026) : **règle D26, une
  seule vérification complète par lot.**
  - Les agents de développement (`dev-*`), le correcteur et le lead-architecte ne lancent plus
    `pnpm check` ni la mutation complète.
  - Ils font des vérifications ciblées : lint, typecheck, `test:coverage` du paquet touché, e2e ou
    parcours des fichiers touchés, mutation des seuls fichiers touchés, `pnpm integrity`, et
    `pnpm hooks:test` ou `pnpm integrity:test` si les garde-fous sont touchés.
  - La recette (chef-de-projet) lance l'unique `TURBO_FORCE=true pnpm check`, sur la branche déjà à
    jour de `develop`, après accord de l'autre session, que l'orchestrateur obtient.
  - Pas de nouveau check à la fusion si `develop` n'a pas bougé.
  - La CI reste le filet.
  - À reporter dans `CLAUDE.md` (phrase des e2e avant livraison, « Worktrees en parallèle »,
    commandes) et dans les fichiers d'agents (« Méthode » et « Terminé quand » de `dev-api`,
    `dev-sql`, `dev-contrats`, `dev-devops`, `dev-front`, `correcteur`, `lead-architecte`, `qa`,
    `qa-front` ; recette du chef-de-projet), sans toucher la section commune « Git et garde-fous ».

## 7 septies. Lot 15 — Brief back-001 de la session front (validé par Julien le 19 nov. 2026)

Demande : `docs/briefs/back-001-donnees-front.md` (tickets BF-1 à BF-7 : profil restructuré, liens
expérience-compétence cachés, stack principale, recommandations, section IA, lien des recommandations
LinkedIn, OpenAPI). Un seul lot en trois étapes sur la même branche, contrats puis SQL puis API, pour que
`develop` reste vert (les contrôleurs valident leurs réponses par les schémas du contrat : un contrat
fusionné seul casserait l'API) ; la session front lit les contrats sur la branche du lot dès la première
étape commitée. `info.version` reste 1.0.0 (contrat encore sans client). Questions posées à Julien avant
lancement : droit des dev-* de modifier un test existant rendu obsolète par un brief validé ; données
réelles ou fictives pour les recommandations (BF-4) dans un dépôt destiné à devenir public. Ports Docker
du back en 57xx (la plage 58xx est celle de la session front).

Décision connexe du même jour : l'**écart résiduel Caddy** (réponses `text/plain` produites par Caddy
avant l'API : 400 URL mal encodée, 413 corps trop grand, 502 API injoignable) est **accepté** et reste
consigné dans `docs/deploiement.md` ; le front le gérera de son côté (une réponse non JSON est traitée
comme une erreur générique).

Fusionné le 20 nov. 2026 (baa259d), recette acceptée. Décisions de Julien du 20 nov. 2026 sur les écarts au
brief : `mainStackOrder` reste dans toutes les compétences servies, y compris celles imbriquées dans
`/projects` (pas de schéma de compétence réduit) ; `cvPath` reste restreint à un chemin relatif à la racine du
site (il est placé dans un `href` par le front).

## 8. Points ouverts et risques

### Points ouverts (à trancher par Julien, valeurs par défaut proposées pour ne pas bloquer)

| # | Sujet | Défaut retenu si pas de réponse |
|---|---|---|
| P1 | URL `github` et `website` pour `social_links` : le CV ne donne que LinkedIn. | Seeder uniquement `linkedin` ; `github` ajouté si l'URL est fournie. |
| P2 | Niveaux (`level` 1-5) des compétences : non présents dans le CV (V2 : tout à 3). | 3 partout, ajustable plus tard par un seed. |
| P3 | Icônes des compétences : slug devicon vs SVG maison (`icon_path`). | Slug devicon quand il existe, sinon `icon` = slug de la compétence et `icon_path` null. |
| P4 | Fichiers images (portrait, logos) : produits par le front ; chemins fixés par les seeds. | Convention `/images/profile/portrait.jpg`, `/images/logos/<slug>.svg`. |
| P5 | Contenu de `projects`, `tools`, `resources` : vide dans la V2 et absent du CV. | Tables créées, aucun seed, routes renvoient `[]`. |
| P6 | Formation : 1 ligne « autodidacte » + 2 lignes (EEMI 2016, OpenClassrooms 2015) ou 1 seule ligne ? | 3 lignes, `sort_order` chronologique inverse. |
| P7 | Texte brut ou Markdown léger pour `bio`, `summary`, `description` (docs/01 : « à trancher au design »). | Texte brut sans balisage ; le contrat ne le précise pas, à documenter dans OpenAPI quand tranché. |
| P8 | `lang` en majuscules (`?lang=EN`) : 400 ou normalisation ? | 400 (contrat strict `fr|en`, `LocaleSchema` livré). |
| P9 | En-têtes : le lot 0 livre helmet sans CSP et `x-frame-options: SAMEORIGIN` (défauts helmet, API JSON). Garder, ou imposer `DENY` + `content-security-policy: default-src 'none'` ? | Garder la livraison du lot 0 ; L4-05 teste ce qui est livré. |
| P10 | Domaine du front pour `CORS_ORIGIN` et `SITE_DOMAIN` en production. | Placeholders `https://example.com` / `example.com`. |
| P11 | Doit-on garder `GET /api/v1/skills` à plat alors que `/skill-groups` les imbrique ? (docs/01 liste les deux.) | Conserver les deux, conformément à docs/01. |
| P12 | Rate limiting : seuil par défaut de 100 requêtes/minute/IP (lot 0), store en mémoire (une instance d'API). | Garder ; modifiable sans code via `RATE_LIMIT_MAX` et `RATE_LIMIT_WINDOW_MS`. |
| P13 | Faut-il commiter un instantané `openapi.json` dans le repo pour le portage Rust, en plus de `dist/openapi.json` (build) et de `GET /docs.json` ? | Non : le document est généré depuis les schémas Zod (aucune dérive possible) ; un export est produit à la demande par `openapi:export`. |
| P14 | `OpenAPI info.version` vaut `1.0.0` (version du contrat public) alors que les paquets sont en `0.0.0`. | Garder `1.0.0` comme version du contrat que le portage Rust devra honorer. |
| P15 | Répartition A/B du lot 3 : le lead propose A = profile, social-links, skill-groups, skills, experiences, projects ; B = tools, resources, certifications, education, languages, cv. | Conserver la répartition de la section 4 (A : experiences + skill-groups ; B : cv + projects), équilibrée par complexité. |

### Risques identifiés

| # | Risque | Impact | Mitigation |
|---|---|---|---|
| R1 | Versions majeures récentes (TypeScript 6.0.3, ESLint 10, Vitest 5, NestJS 12, Zod 4, postgres 4) : tout passe au lot 0, incompatibilité possible au lot 3. | Lint, build ou tests cassés. | Rétrograder la brique concernée en un commit `chore` dédié plutôt que de contourner ; consigner dans le compte rendu. |
| R2 | Zod 4 et `zod-to-openapi` 9 : schémas composés (`strict`, `nullable`, raffinements, `.default()` qui rend un champ optionnel) mal rendus en OpenAPI 3.2. | Document non conforme pour le portage Rust. | Validateur OpenAPI 3.2 dans `document.spec.ts` (L2-06), conformité Ajv des réponses (L4-06). |
| R3 | NestJS 12 + Fastify 5 : plugins `@fastify/*` enregistrés sur l'instance Fastify. | En-têtes absents, CORS inopérant. | Vérifié par les e2e du lot 0 (`health`, `rate-limit`), complété au lot 4 (L4-05). |
| R4 | Repli de locale en SQL : jointure double (`fr` + `en`) sur chaque table de traduction, risque de N+1 ou d'oubli dans un module. | Réponses incohérentes entre modules A et B. | Patron de requête imposé (lot 3), test de repli par module, matrice de repli (L4-02), revue de la duplication (L6-01). |
| R5 | Parallélisme A/B au lot 3 : `cv` (B) dépend des cas d'usage de A. | `cv` non testable e2e avant fusion. | Signatures et noms de classes fixés dans ce backlog ; unitaires avec doublures ; e2e `cv` joué par le CdP à l'intégration. |
| R6 | Hook pre-commit sans e2e : un commit peut casser les e2e sans être bloqué. | Régression découverte tard. | `pnpm check` obligatoire avant de livrer un lot (D3), CI rejoue tout (L5-04), D6 exige la déclaration. |
| R7 | Traductions EN produites par un agent. | Qualité éditoriale. | Marquage « à relire » systématique et liste centralisée (L1-14, `CLAUDE.md`). |
| R8 | Fuite de données personnelles par inadvertance (seed, fixtures, docs, `.env`). | Non négociable violé. | Critère D7 à chaque ticket, test L1-13, grep en revue sécurité. |
| R9 | Modification d'une migration déjà appliquée sur le VPS. | Divergence de schéma. | Checksum dans `schema_migrations` (L1-01), règle dans `db/README.md`. |
| R10 | Compose prod : Caddy sans front (`apps/web` différé). | Page d'accueil vide en production. | Placeholder statique minimal (L5-02), à remplacer lors du lot front. |
| R11 | Dérive entre le document OpenAPI et les réponses réelles de l'API (le document est généré depuis Zod, mais les contrôleurs pourraient renvoyer autre chose). | Contrat faux pour le portage Rust. | Validation `strict` des réponses dans chaque contrôleur (lot 3), test L4-06. |
| R12 | `TRUST_PROXY` oublié en prod derrière Caddy. | Rate limiting appliqué à l'IP du proxy : tout le trafic partagé. | `TRUST_PROXY=uniquelocal` imposé dans `compose.prod.yml` (L5-02), vérifié en revue sécurité (L6-02). |
| R13 | Node téléchargé par pnpm (`use-node-version`) : accès réseau au premier `pnpm install`, comportement différent en CI et dans l'image Docker. | Build CI ou Docker cassé. | Même version 26.13.1 partout (`.npmrc`, `node:26.13.1-alpine`, CI), téléchargement neutralisé dans l'image (L5-01). |

## 9. Versions installées au lot 0 (épinglées exactement ; à revérifier avec `pnpm view <pkg> version` avant tout ajout)

`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-fastify`, `@nestjs/testing` 12.5.1 · `fastify` 5.12.8 ·
`@fastify/helmet` 13.2.0 · `@fastify/cors` 11.4.3 · `@fastify/rate-limit` 11.2.2 · `reflect-metadata` 0.2.2 ·
`rxjs` 7.8.2 · `drizzle-orm` 0.45.4 · `postgres` 4.1.1 · `zod` 4.6.7 · `@asteasolutions/zod-to-openapi` 9.1.0 · `openapi3-ts` 4.6.2 · `vitest` 5.1.1 ·
`unplugin-swc` 2.0.0 · `@swc/core` 1.16.22 · `@swc-node/register` 1.12.1 · `tsx` 4.23.15 · `typescript` 6.0.3
(la 7.x est `latest` mais `typescript-eslint` exige `< 6.1`) · `typescript-eslint` 8.73.0 · `eslint` 10.15.0 ·
`@eslint/js` 10.0.1 · `eslint-config-prettier` 10.1.8 · `prettier` 3.10.1 · `turbo` 2.11.12 · `husky` 9.1.7 ·
`@types/node` 26.6.6. Image `postgres:16-alpine`.
Hôte : pnpm 10.34.9 (`packageManager`, lot 6), Node 26.13.1 téléchargé par pnpm (`.npmrc`), Docker Compose v2.40.
