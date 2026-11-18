# Lot 0 : fondations, compte rendu du lead back-end

Branche `lot/0-fondations` (worktree), 14 commits atomiques au-dessus de `v3/backend`
(11 de la livraison initiale, 3 de correction après recette).
Vérification finale le 18 novembre 2026 : `pnpm install --frozen-lockfile` propre, `pnpm check`
vert (lint, typecheck, 14 tests unitaires, 23 tests e2e contre le postgres de test), API démarrée
contre le postgres de dev et vérifiée avec curl.

## Corrections après recette

1. Rate limiting global (docs/02 « sécurité dès le départ ») : `@fastify/rate-limit` posé dans
   `create-app.ts`, seuil `RATE_LIMIT_MAX` (défaut 100) par fenêtre `RATE_LIMIT_WINDOW_MS`
   (défaut 60 000 ms) et par IP, `TRUST_PROXY` (défaut `false`) pour lire l'IP cliente derrière
   Caddy ; 429 `application/problem+json` avec `retry-after`. Tests unitaires de la
   configuration, e2e des en-têtes `x-ratelimit-limit`/`remaining`/`reset`, du 429 et du
   comptage par IP. Vérifié avec curl : `x-ratelimit-limit: 5`, `x-ratelimit-remaining: 3`,
   puis `429 Too Many Requests` problem+json une fois le quota épuisé.
2. `CLAUDE.md` reprend la règle de docs/03 sur les traductions EN : produites par l'agent base
   de données au lot 1, listées dans `docs/traductions-a-relire.md` pour relecture par Julien.

## Fait

- Monorepo pnpm workspaces + Turborepo (`apps/*`, `packages/*`), TypeScript strict partagé
  (`tsconfig.base.json`), ESLint flat config typée + Prettier, `.editorconfig`.
- `packages/contracts` : schémas Zod (`Locale`, `LocaleQuery`, `ProblemDetails`,
  `HealthResponse`), `createOpenApiDocument()` (OpenAPI 3.1, `servers: /api/v1`), export
  `dist/openapi.json` au build, tests unitaires du document.
- `apps/api` : NestJS sur Fastify (ESM), architecture hexagonale `domain` / `application` /
  `infrastructure` ; configuration validée par Zod (`APP_CONFIG`) ; client Drizzle + driver
  `postgres` derrière un port (`DATABASE_CLIENT`) ; helmet, CORS restreint (GET/HEAD/OPTIONS),
  rate limiting global par IP (`@fastify/rate-limit`, 100 requêtes/minute par défaut),
  préfixe global `api/v1`, shutdown hooks.
- Erreurs RFC 9457 : filtre global `ProblemDetailsFilter` (`application/problem+json`),
  traduction `HttpException` / `EntityNotFoundError` / erreurs Fastify, 500 au détail générique,
  journalisation des 5xx sans fuite de pile. Tests unitaires du filtre.
- `GET /health` (cas d'usage pur + ping SQL, 503 si base injoignable) et `GET /docs.json`
  (contrat OpenAPI servi depuis les contrats, cache 5 min).
- Un module Nest vide par ressource de docs/01 (profile, social-links, skill-groups, skills,
  experiences, projects, tools, resources, certifications, education, languages, cv), déjà
  enregistré dans `AppModule`, chaque GET répond 501 problem+json.
- Tests e2e Vitest via `app.inject` : health, en-têtes de sécurité, CORS, rate limiting
  (en-têtes, 429, par IP), docs.json, les 12 routes en 501, 404 sous et hors préfixe, absence
  de pile dans les réponses.
- `db/migrations` et `db/seeds` avec `db/README.md` (convention `NNNN_description.sql`,
  idempotence par `slug`, runner prévu au lot 1).
- `docker-compose.yml` : `postgres` (dev, volume nommé, 127.0.0.1:5432) et `postgres-test`
  (tmpfs, 127.0.0.1:5433), healthchecks ; `.env.example` sans secret.
- Hook pre-commit husky : `turbo run lint typecheck test`. Les e2e sont dans `pnpm check`.
- `CLAUDE.md` (conventions, règles hexagonales, règle « modules isolés » pour le lot 3,
  fichiers partagés interdits aux agents de ressource, flux git, interdictions, traductions EN
  à relire dans `docs/traductions-a-relire.md`) et `README.md`.
- Vérifications curl : `/api/v1/health` 200 `{"status":"ok","checks":{"database":"up"}}` ;
  `/api/v1/docs.json` 200 avec `"openapi":"3.1.0"` ; `/api/v1/profile` 501
  `application/problem+json` ; `/api/v1/inconnue` 404 `application/problem+json`.

## Non fait

- Dockerfile multi-stage, compose de prod (Caddy), CI GitHub Actions : lot 5, hors périmètre.
- Runner de migrations, schéma Drizzle dérivé du SQL, seeds : lot 1.
- Schémas Zod et chemins OpenAPI des ressources : lot 2. Le document ne décrit pour l'instant
  que `/health` et le schéma `ProblemDetails`.
- Implémentation des ressources, repli de langue, `GET /cv` : lot 3.
- Aucun `apps/api/.env` commité (ignoré par git) : chaque poste copie `.env.example`.

## Décisions prises

Versions (stables au 18 novembre 2026, vérifiées sur npm, épinglées exactement) :

| Brique | Choix |
|---|---|
| Node | 22.23.5 téléchargé par pnpm (`.npmrc` `use-node-version`), `engines` `>=22.11.0 <23` ; pnpm 9 (`packageManager` 9.0.0) |
| Monorepo | pnpm workspaces, turbo 2.11.12 (`lint`/`typecheck`/`test`/`test:e2e` dépendent de `^build`) |
| Langage | typescript 6.0.3, `module: NodeNext`, ESM partout, imports relatifs avec `.js` |
| Qualité | eslint 10.15.0 + typescript-eslint 8.73.0 (recommendedTypeChecked + stylisticTypeChecked), prettier 3.10.1, husky 9.1.7 |
| API | @nestjs/common, core, platform-fastify, testing 12.5.1 ; fastify 5.12.8 ; @fastify/helmet 13.2.0 ; @fastify/cors 11.4.3 ; @fastify/rate-limit 11.2.2 ; reflect-metadata 0.2.2 ; rxjs 7.8.2 |
| Données | drizzle-orm 0.45.4 (`drizzle-orm/postgres-js`), postgres 4.1.1 |
| Validation / contrat | zod 4.6.7, zod-openapi 6.0.2 |
| Tests | vitest 5.1.1, unplugin-swc 2.0.0 + @swc/core 1.16.22 (métadonnées de décorateurs), @swc-node/register 1.12.1 pour `pnpm dev` (`node --watch --import`) |
| Base | postgres:16-alpine |

Structure et conventions :

- Hexagonal strict : `domain` sans dépendance, `application` = cas d'usage sans décorateur et
  ports (`interface` + jeton `Symbol`), Nest uniquement dans `infrastructure/http` et dans
  les modules Nest de `config`/`db`. Les cas d'usage sont fournis par `useFactory` +
  `inject`.
- Validation explicite par `safeParse` des schémas de `@siteperso/contracts` dans les
  controllers ; aucun pipe global, aucun décorateur métier.
- Contrat OpenAPI généré par `zod-openapi` (lit `.meta({ id })` natif de Zod 4, pas de
  patch de prototype ni de registre parallèle), servi par `GET /api/v1/docs.json` et exporté
  dans `packages/contracts/dist/openapi.json`.
- `@siteperso/contracts` consommé via `dist/` (pas d'alias source) : même résolution en dev,
  en test et en build ; `pnpm dev` compile les contrats avant de lancer l'API.
- Tests e2e par `app.inject` (light-my-request), sans supertest ni port ouvert, un seul
  processus (`fileParallelism: false`) ; configuration de test par défaut dans
  `vitest.e2e.config.ts` (postgres de test sur 5433), surchargeable par l'environnement.
- Sécurité : helmet sans CSP (API JSON), CORS limité aux origines de `CORS_ORIGIN` et aux
  méthodes GET/HEAD/OPTIONS, rate limiting global par IP (`RATE_LIMIT_MAX` par
  `RATE_LIMIT_WINDOW_MS`, défaut 100/minute, 429 problem+json), `x-powered-by` absent, 5xx
  jamais détaillées. `createApp` lit la configuration (`loadEnv`) avant de construire Fastify
  car `trustProxy` se fixe à la création de l'adaptateur ; `ConfigModule` fournit la même
  configuration validée au reste de l'application.
- Un module Nest vide par ressource dès le lot 0 pour que les deux agents du lot 3 ne touchent
  que leurs propres dossiers (règle « modules isolés » et liste des fichiers partagés dans
  `CLAUDE.md`).

Écarts avec docs/02 :

- « husky facultatif » : activé, le hook pre-commit lance lint, typecheck et tests unitaires
  (docs/03 impose « aucun commit si lint et tests ne passent pas »).
- « Node.js LTS courant » : l'hôte a Node 22.11 ; ESLint 10, Vite et Vitest 5 exigent
  >= 22.13, donc pnpm télécharge 22.23.5 (`use-node-version`), rien d'installé globalement.
- « Vitest + supertest/app.inject » : `app.inject` seul, supertest non ajouté.
- `docs/` est exclu de Prettier pour ne pas reformater les documents validés ; les comptes
  rendus y sont donc écrits à la main au même format.

## Points ouverts

1. Rate limiting : seuil par défaut de 100 requêtes/minute/IP à confirmer par Julien
   (modifiable sans code via `RATE_LIMIT_MAX` et `RATE_LIMIT_WINDOW_MS`). En prod derrière
   Caddy, le compose du lot 5 doit poser `TRUST_PROXY=true`, sinon toutes les requêtes
   partagent le quota de l'IP du proxy. Le store est en mémoire (une seule instance d'API) ;
   un store partagé n'est pas prévu.
2. Lot 2 et lot 3 touchent des fichiers partagés (`packages/contracts/src/index.ts`,
   `openapi/document.ts`) : un seul agent au lot 2, pas de conflit ; au lot 3, chaque agent
   signale ses besoins dans son compte rendu et l'orchestrateur applique.
3. `CvModule` (lot 3) agrège les cas d'usage des autres ressources : les modules de ressource
   devront exporter leurs cas d'usage (`exports: [...]`). À répartir entre les deux agents API
   (proposition : agent A = profile, social-links, skill-groups, skills, experiences, projects ;
   agent B = tools, resources, certifications, education, languages, cv).
4. Versions majeures récentes (TypeScript 6, ESLint 10, Vitest 5, NestJS 12, Zod 4,
   postgres 4) : tout passe aujourd'hui ; si une incompatibilité apparaît au lot 3, on rétrograde
   la brique concernée en un commit `chore` dédié plutôt que de contourner.
5. `OpenAPI info.version` vaut `1.0.0` (version du contrat) alors que les paquets sont en
   `0.0.0` : à confirmer que c'est bien la version de l'API publique que le portage Rust
   devra honorer.
6. Premier `pnpm install` : pnpm télécharge Node 22.23.5 (accès réseau requis) ; en CI (lot 5)
   utiliser `pnpm/action-setup` + le même `.npmrc`, ou fixer Node 22.23.5 dans l'image.
