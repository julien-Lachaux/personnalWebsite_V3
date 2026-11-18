# Backlog du back-end V3

Rédigé le 18 novembre 2026 par le chef de projet, dérivé strictement de `docs/01-modele-de-donnees.md`,
`docs/02-stack-technique.md` et `docs/03-organisation-agents.md`. Ces trois documents sont les décisions
validées ; ce backlog les décline en lots, tickets et critères d'acceptation. Il ne les remet pas en cause.

Conventions de ce document :

- Un ticket = une micro-tâche = au moins un commit atomique (Conventional Commits en français).
- Les critères d'acceptation sont formulés comme des commandes ou des tests ; « passe » signifie code de
  sortie 0. Les commandes se lancent à la racine du repo sauf mention contraire.
- Les chemins sont relatifs à la racine du monorepo.
- Les identifiants de code sont en anglais, le texte libre (commentaires, docs, messages) en français.

## 0. Rappels transverses

### 0.1 Règles non négociables (reprises dans `CLAUDE.md` au lot 0)

- Jamais de `git push` par un agent. Jamais de commit si lint, typecheck et tests ne passent pas.
- Commits atomiques, un par micro-tâche, format `type(scope): sujet` en français, suivi d'une ligne vide
  puis du trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Aucun e-mail, numéro de téléphone ni donnée personnelle de contact nulle part dans le repo
  (code, SQL, docs, tests, fixtures, `.env.example`). Les exemples utilisent des placeholders
  (`contact@example.com`, `+33 0 00 00 00 00`). Le nom, le titre, la localisation et les URL publiques de
  profils professionnels sont du contenu de CV publié et sont seedés ; l'e-mail et le téléphone jamais.
- Node 22 et pnpm 9 sont utilisés directement sur l'hôte. PostgreSQL tourne uniquement en Docker
  (`docker compose`). Rien d'autre n'est installé globalement.
- Versions : chaque paquet est ajouté à sa version stable courante vérifiée avec `pnpm view <pkg> version`,
  jamais une version mémorisée. Les versions relevées le 18 novembre 2026 sont indiquées en section 9 à
  titre de repère ; elles sont à revérifier au moment de l'installation.
- Flux Git : branche d'intégration `v3/backend`, une branche et un worktree par lot (`lot/0-fondations`,
  `lot/1-sql`, `lot/2-contrats`, `lot/3-api-a`, `lot/3-api-b`, `lot/4-qa`, `lot/5-devops`,
  `lot/6-corrections`), fusion `--no-ff` par l'orchestrateur après recette du chef de projet.

### 0.2 Définition de « terminé » (commune à tous les lots)

Un ticket est terminé quand toutes les conditions suivantes sont vraies. Un lot est terminé quand tous ses
tickets le sont et que le chef de projet a validé la livraison contre les critères du lot.

| # | Condition | Vérification |
|---|---|---|
| D1 | Lint propre | `pnpm lint` passe |
| D2 | Typecheck propre | `pnpm typecheck` passe |
| D3 | Tests verts (unitaires et e2e du périmètre touché) | `pnpm test` passe avec le Postgres de test Docker démarré |
| D4 | Build propre | `pnpm build` passe |
| D5 | Commits atomiques, un par micro-tâche, Conventional Commits en français avec trailer `Co-Authored-By` | `git log --format=%B v3/backend..HEAD` : chaque message matche `^(feat|fix|docs|chore|refactor|test|ci|build|perf|style)\([a-z0-9-]+\): .+` et contient le trailer |
| D6 | Hook pre-commit non contourné | aucun commit n'a été fait avec `--no-verify` (déclaré dans le compte rendu) |
| D7 | Aucune donnée personnelle de contact | `git grep -nE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' -- ':!*.lock' ':!pnpm-lock.yaml'` ne remonte que des placeholders `@example.com` ou le trailer `noreply@anthropic.com` ; `git grep -nE '(\+33|0)[1-9]([ .-]?[0-9]{2}){4}' -- ':!pnpm-lock.yaml'` ne remonte que des placeholders `+33 0 00 00 00 00` |
| D8 | Conventions `CLAUDE.md` respectées (structure hexagonale, Nest confiné à `infrastructure/http`, pas de décorateurs métier, SQL source de vérité, textes en français, identifiants en anglais) | règles ESLint `no-restricted-imports` du lot 0 passent ; revue du chef de projet |
| D9 | Compte rendu court livré | fichier `docs/comptes-rendus/lot-<N>-<role>.md` présent avec les sections « Fait », « Non fait », « Décisions prises », « Points ouverts » |
| D10 | Aucun fichier hors périmètre du lot modifié | `git diff --stat v3/backend..HEAD` ne liste que les dossiers autorisés du lot |

### 0.3 Dépendances entre lots

```
lot 0 fondations ──┬── lot 1 SQL + seeds ──┐
                   └── lot 2 contrats ─────┴── lot 3 API (A ∥ B) ── lot 4 QA ──┐
                                                                               ├── lot 6 revues + corrections ── CdP : recette finale
                                           lot 5 DevOps (dès lot 0) ───────────┘
```

Points de contrôle où l'orchestrateur attend Julien : après le lot 0 (structure et conventions), et à la fin
(compte rendu du chef de projet).

### 0.4 Arborescence cible (référence pour tous les tickets)

```
personnalWebsite_V3/
  apps/api/                      NestJS sur Fastify
    src/main.ts                  bootstrap Fastify, helmet, cors, rate limit
    src/app.module.ts            enregistre les 12 modules + health
    src/shared/config/           chargement et validation Zod des variables d'environnement
    src/shared/http/             filtre problem+json, 404, parsing de ?lang
    src/shared/i18n/             règle de repli de locale (fonction pure)
    src/infrastructure/db/       client Drizzle, schéma Drizzle (dérivé du SQL), runner migrations/seeds
    src/cli/migrate.ts           point d'entrée `db:migrate`
    src/cli/seed.ts              point d'entrée `db:seed`
    src/modules/<resource>/      domain/ application/ infrastructure/{http,db}/
    test/e2e/                    tests e2e (app.inject contre Postgres Docker)
  apps/web/                      Nuxt, hors périmètre de ce backlog (dossier réservé, vide)
  packages/contracts/            schémas Zod, types, génération OpenAPI, openapi/openapi.json
  db/migrations/NNNN_description.sql
  db/seeds/NNNN_contenu.sql
  docker/                        Dockerfile, compose.dev.yml, compose.prod.yml, Caddyfile
  scripts/                       scripts shell (déploiement)
  docs/                          décisions, backlog, comptes rendus, revues
  .github/workflows/ci.yml
  CLAUDE.md, README.md
```

Les 12 modules API (ressources) : `profile`, `social-links`, `skill-groups`, `skills`, `experiences`,
`projects`, `tools`, `resources`, `certifications`, `education`, `languages`, `cv`. Le module `health` fait
partie du socle (lot 0).

---

## 1. Lot 0 — Fondations

- **Objectif** : un monorepo qui s'installe, lint, typecheck, teste et démarre à vide, avec toutes les
  conventions posées pour que les lots suivants n'aient à toucher que leurs propres fichiers.
- **Dépendances** : aucune (part de `v3/backend` qui ne contient que `docs/`).
- **Agent responsable** : Lead back-end (branche `lot/0-fondations`).
- **Périmètre autorisé** : tout le repo sauf `docs/0*.md` et `docs/backlog.md`.
- **Point de contrôle** : validation par Julien de la structure et de `CLAUDE.md` avant lancement des lots 1, 2 et 5.

### L0-01 — Monorepo pnpm + Turborepo

- **Description** : initialiser le monorepo : `package.json` racine privé (`packageManager: pnpm@9.x`,
  `engines.node: ">=22"`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` avec les tâches
  `build`, `lint`, `typecheck`, `test`, `test:unit`, `test:e2e`, `.nvmrc` (22), `.editorconfig`,
  `tsconfig.base.json` strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `module: NodeNext`), ESLint flat config + Prettier partagés à la racine, `.gitignore` complété
  (`node_modules`, `dist`, `.env*` sauf `.env.example`, `coverage`, `.turbo`). Scripts racine : `lint`,
  `lint:fix`, `format`, `typecheck`, `test`, `test:unit`, `test:e2e`, `build`, `db:up`, `db:down`,
  `db:migrate`, `db:seed`. Toutes les versions vérifiées avec `pnpm view`.
- **Fichiers** : `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.editorconfig`,
  `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `pnpm-lock.yaml`.
- **Critères d'acceptation** :
  - `pnpm install --frozen-lockfile` passe.
  - `node -e "const p=require('./package.json');process.exit(/^pnpm@9\./.test(p.packageManager)?0:1)"` passe.
  - `pnpm turbo run lint typecheck build --dry-run=json` liste les tâches pour `@v3/api` et `@v3/contracts`.
  - `pnpm lint` et `pnpm format --check` (équivalent `prettier --check .`) passent.

### L0-02 — Squelette `packages/contracts`

- **Description** : créer le paquet `@v3/contracts` (ESM, TypeScript strict) avec Zod et le générateur
  OpenAPI (`@asteasolutions/zod-to-openapi` ou équivalent compatible Zod 4) en dépendances, un point d'entrée
  `src/index.ts` exportant un schéma minimal `HealthResponseSchema` et `ProblemDetailsSchema` (RFC 9457),
  un script `build` (tsc vers `dist/`), `typecheck`, `test` (Vitest) et `openapi:generate` (écrit
  `openapi/openapi.json`, vide de chemins à ce stade hormis `/health`). `apps/api` dépend de
  `@v3/contracts` via `workspace:*`.
- **Fichiers** : `packages/contracts/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/common/health.ts,src/common/problem-details.ts,src/openapi/generate.ts,openapi/openapi.json}`.
- **Critères d'acceptation** :
  - `pnpm --filter @v3/contracts build` passe et produit `packages/contracts/dist/index.js` et `dist/index.d.ts`.
  - `pnpm --filter @v3/contracts openapi:generate` passe et `node -e "const o=require('./packages/contracts/openapi/openapi.json');process.exit(o.openapi.startsWith('3.1')&&o.paths['/health']?0:1)"` passe.
  - `pnpm --filter @v3/contracts test` passe (au moins un test : `ProblemDetailsSchema` accepte un exemple valide et rejette `status: "abc"`).

### L0-03 — API NestJS/Fastify hexagonale et socle HTTP

- **Description** : créer `apps/api` (`@v3/api`) : NestJS sur `@nestjs/platform-fastify`, `main.ts` qui
  enregistre `@fastify/helmet`, `@fastify/cors` (origine unique lue dans `CORS_ORIGIN`),
  `@fastify/rate-limit` (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`), préfixe global `/api/v1`,
  désactivation de `x-powered-by`. Configuration validée par Zod au démarrage (`PORT`, `DATABASE_URL`,
  `CORS_ORIGIN`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `NODE_ENV` ; `DATABASE_URL_TEST` optionnelle,
  utilisée par les tests seulement) : une variable obligatoire manquante fait échouer le démarrage avec un
  message explicite. Filtre d'exception global produisant du `application/problem+json`
  (RFC 9457 : `type`, `title`, `status`, `detail`, `instance`) pour toutes les erreurs, 404 propre pour toute
  route inconnue, 400 pour `?lang` invalide. Parsing explicite de `?lang=fr|en` (défaut `fr`) via le schéma
  Zod des contrats, sans pipe Nest. Fonction pure `pickTranslation(locale, translations)` dans
  `src/shared/i18n/` implémentant le repli `en → fr` (sans dépendance Nest ni Drizzle). Module `health`
  (`GET /api/v1/health` → `{ status: "ok" }` ; aucune information de version ni d'environnement exposée).
  Client Drizzle + driver `postgres` dans `src/infrastructure/db/client.ts` (connexion paresseuse, pool
  fermé à l'arrêt). Règle ESLint `no-restricted-imports` : `@nestjs/*`, `fastify`, `drizzle-orm`, `postgres`
  interdits sous `**/domain/**` et `**/application/**` ; `@nestjs/*` interdit sous `**/infrastructure/db/**`.
  `.env.example` avec placeholders uniquement.
- **Fichiers** : `apps/api/{package.json,tsconfig.json,tsconfig.build.json,nest-cli.json,vitest.config.ts,.env.example}`, `apps/api/src/{main.ts,app.module.ts}`, `apps/api/src/shared/{config,http,i18n}/**`, `apps/api/src/modules/health/**`, `apps/api/src/infrastructure/db/client.ts`, règles dans `eslint.config.js`.
- **Critères d'acceptation** :
  - `pnpm --filter @v3/api build` passe et produit `apps/api/dist/main.js`.
  - `pnpm --filter @v3/api typecheck` passe.
  - `pnpm lint` passe, et un fichier de test temporaire `apps/api/src/modules/health/domain/x.ts` contenant `import '@nestjs/common'` fait échouer `pnpm lint` (vérification manuelle décrite dans le compte rendu, fichier supprimé ensuite).
  - `grep -rl "@nestjs" apps/api/src --include=*.ts | grep -vE "/infrastructure/http/|/main\.ts$|/app\.module\.ts$|\.module\.ts$"` ne renvoie rien.
  - Test unitaire `pickTranslation` : `en` présent → `en` ; `en` absent → `fr` ; `fr` absent → erreur explicite.
  - `cd apps/api && PORT=3999 CORS_ORIGIN=https://example.com DATABASE_URL=postgres://user:pass@localhost:5432/placeholder RATE_LIMIT_MAX=100 RATE_LIMIT_WINDOW_MS=60000 node dist/main.js & sleep 3 ; curl -s -o /dev/null -w '%{http_code}' http://localhost:3999/api/v1/health` renvoie `200` (le `/health` ne touche pas la base : connexion paresseuse).
  - `curl -s -i http://localhost:3999/api/v1/inconnu` renvoie `404`, `content-type: application/problem+json` et un corps conforme à `ProblemDetailsSchema`.
  - `curl -s -i http://localhost:3999/api/v1/health` contient `x-content-type-options: nosniff`, `x-frame-options`, `content-security-policy`, `referrer-policy` et ne contient pas `x-powered-by`.
  - `CORS_ORIGIN= node dist/main.js` échoue avec un message listant la variable manquante.

### L0-04 — Modules vides enregistrés pour les 12 ressources

- **Description** : créer, pour chacune des 12 ressources (`profile`, `social-links`, `skill-groups`,
  `skills`, `experiences`, `projects`, `tools`, `resources`, `certifications`, `education`, `languages`,
  `cv`), un dossier `apps/api/src/modules/<resource>/` contenant `domain/.gitkeep`, `application/.gitkeep`,
  `infrastructure/db/.gitkeep`, `infrastructure/http/<resource>.module.ts` (module Nest vide, sans
  contrôleur) et l'enregistrer dans `app.module.ts`. Les deux agents du lot 3 ne toucheront ensuite qu'à
  leurs propres dossiers de modules. Tout appel à une route de ressource renvoie 404 problem+json à ce stade.
- **Fichiers** : `apps/api/src/modules/*/**`, `apps/api/src/app.module.ts`.
- **Critères d'acceptation** :
  - `for m in profile social-links skill-groups skills experiences projects tools resources certifications education languages cv; do test -f apps/api/src/modules/$m/infrastructure/http/$m.module.ts || exit 1; done` passe.
  - `grep -c "Module," apps/api/src/app.module.ts` ≥ 13 (12 ressources + health) ; test unitaire qui compile `AppModule` avec `Test.createTestingModule` et vérifie que les 12 modules sont résolus.
  - `pnpm --filter @v3/api build` passe.

### L0-05 — Dossiers `db/` et commandes `db:migrate` / `db:seed`

- **Description** : créer `db/migrations/` et `db/seeds/` avec un `README.md` chacun (format des fichiers
  `NNNN_description.sql`, règles d'idempotence `on conflict (slug) do update`, interdiction de modifier
  une migration appliquée), un fichier `.gitkeep`, et les points d'entrée `apps/api/src/cli/migrate.ts`
  et `seed.ts` qui, à ce stade, lisent et listent les fichiers des deux dossiers (le runner réel est le
  ticket L1-01 ; le lot 0 livre uniquement l'emplacement, le contrat de ligne de commande et le câblage
  `pnpm db:migrate` / `pnpm db:seed` → `tsx` ou `node dist/cli/*.js`).
- **Fichiers** : `db/migrations/README.md`, `db/seeds/README.md`, `apps/api/src/cli/{migrate.ts,seed.ts}`, scripts dans `apps/api/package.json` et `package.json`.
- **Critères d'acceptation** :
  - `test -d db/migrations && test -d db/seeds && test -f db/migrations/README.md && test -f db/seeds/README.md` passe.
  - `pnpm db:migrate` et `pnpm db:seed` passent avec le Postgres Docker démarré (sortie : « 0 fichier à appliquer »).

### L0-06 — Compose de développement (api + postgres + postgres de test)

- **Description** : `docker/compose.dev.yml` avec les services `postgres` (image `postgres:16-alpine`,
  port publié `127.0.0.1:5432`, volume nommé, healthcheck `pg_isready`), `postgres_test` (même image, port
  `127.0.0.1:5433`, sans volume persistant, healthcheck) et `api` (profil `api`, image `node:22-alpine`,
  bind mount du repo, commande `pnpm --filter @v3/api dev`, dépend de `postgres` healthy). Identifiants de
  base lus dans `.env` (placeholders dans `.env.example`). Scripts `pnpm db:up` (démarre `postgres` et
  `postgres_test` en attendant le healthy) et `pnpm db:down`.
- **Fichiers** : `docker/compose.dev.yml`, `.env.example`, scripts racine.
- **Critères d'acceptation** :
  - `docker compose -f docker/compose.dev.yml config` passe.
  - `pnpm db:up` passe puis `docker compose -f docker/compose.dev.yml ps --format json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const l=d.trim().split('\n').map(JSON.parse);process.exit(l.filter(s=>/healthy/.test(s.Health||s.Status)).length>=2?0:1)})"` passe.
  - `docker compose -f docker/compose.dev.yml config | grep -E '^\s+- "?127\.0\.0\.1:' | wc -l` ≥ 2 et aucune publication `0.0.0.0`.
  - `pnpm db:down` passe.

### L0-07 — Vitest : unitaires et e2e contre Postgres Docker

- **Description** : configuration Vitest de `apps/api` en deux projets : `unit` (`src/**/*.spec.ts`) et
  `e2e` (`test/e2e/**/*.e2e.ts`, `pool: forks`, `fileParallelism: false`). Setup e2e
  (`test/e2e/setup.ts`) : lit `DATABASE_URL_TEST`, échoue immédiatement avec un message clair si le Postgres
  de test est injoignable, construit l'application avec l'adaptateur Fastify et utilise `app.inject`
  (pas de port ouvert). Premiers tests e2e : `GET /api/v1/health` → 200, route inconnue → 404 problem+json,
  en-têtes de sécurité présents, `?lang=de` sur une route de ressource → 400 problem+json (ou 404 tant
  que la ressource n'existe pas : préciser dans le test). Tâches Turborepo `test:unit` et `test:e2e`,
  `test` = les deux.
- **Fichiers** : `apps/api/vitest.config.ts`, `apps/api/test/e2e/{setup.ts,health.e2e.ts,errors.e2e.ts,security-headers.e2e.ts}`, `apps/api/src/shared/i18n/pick-translation.spec.ts`.
- **Critères d'acceptation** :
  - `pnpm db:up && pnpm test` passe.
  - `pnpm test:unit` passe sans Postgres (`pnpm db:down` au préalable).
  - `pnpm db:down && pnpm test:e2e` échoue avec un message contenant « Postgres de test injoignable » (et non une stack trace brute).

### L0-08 — Hook pre-commit et commit-msg

- **Description** : husky + lint-staged. Hook `pre-commit` : `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`
  puis `pnpm test:e2e` (le Postgres de test doit être démarré ; le hook échoue avec le message du L0-07
  sinon). Hook `commit-msg` : vérifie `^(feat|fix|docs|chore|refactor|test|ci|build|perf|style)\([a-z0-9-]+\): .+`
  sur la première ligne et la présence du trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
  Les hooks sont installés par `pnpm install` (script `prepare`).
- **Fichiers** : `.husky/pre-commit`, `.husky/commit-msg`, `.lintstagedrc.json` ou section dans `package.json`, script `prepare`.
- **Critères d'acceptation** :
  - `test -x .husky/pre-commit && test -x .husky/commit-msg` passe après `pnpm install`.
  - `printf 'mauvais message' > /tmp/m && .husky/commit-msg /tmp/m` échoue ; `printf 'feat(api): test\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>\n' > /tmp/m && .husky/commit-msg /tmp/m` passe.
  - Un commit de test introduisant volontairement une erreur de type est refusé par le hook (vérification manuelle décrite dans le compte rendu, commit non conservé).

### L0-09 — `CLAUDE.md` et `README.md`

- **Description** : `CLAUDE.md` à la racine, en français, qui reprend : règles non négociables (section 0.1),
  définition de « terminé » (0.2), flux Git et nommage des branches, format des commits avec trailer,
  arborescence et architecture hexagonale (Nest confiné à `infrastructure/http`, pas de décorateurs métier,
  validation Zod explicite, SQL source de vérité, Drizzle pour les requêtes seulement), conventions de
  nommage (snake_case SQL, camelCase TS, slugs kebab-case), règle de repli de locale, format d'erreur
  problem+json, commandes utiles, interdiction des données personnelles, emplacement des comptes rendus
  (`docs/comptes-rendus/lot-<N>-<role>.md`) et liste des traductions à relire
  (`docs/traductions-a-relire.md`). `README.md` : présentation courte, prérequis (Node 22, pnpm 9, Docker),
  démarrage (`pnpm install`, `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm --filter @v3/api dev`),
  commandes, liens vers `docs/`.
- **Fichiers** : `CLAUDE.md`, `README.md`.
- **Critères d'acceptation** :
  - `for s in "Jamais de git push" "Co-Authored-By" "problem+json" "infrastructure/http" "schema_migrations" "comptes-rendus" "traductions-a-relire" "lang" ; do grep -q -- "$s" CLAUDE.md || exit 1; done` passe.
  - `grep -qE "pnpm db:up|pnpm db:migrate|pnpm db:seed" README.md` passe.
  - Critère D7 (aucune donnée personnelle) passe sur les deux fichiers.

### L0-10 — Vérification finale du lot 0 et compte rendu

- **Description** : exécuter depuis un clone propre du worktree la séquence complète d'installation et de
  vérification, corriger ce qui bloque, rédiger `docs/comptes-rendus/lot-0-lead-backend.md` (fait, non
  fait, décisions prises dont les versions exactes installées, points ouverts).
- **Fichiers** : `docs/comptes-rendus/lot-0-lead-backend.md`, corrections éventuelles.
- **Critères d'acceptation** :
  - `git clean -ndx` ne liste rien d'inattendu puis `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install --frozen-lockfile && pnpm db:up && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm db:down` passe.
  - `git status --porcelain` vide après la séquence (aucun fichier généré non ignoré).
  - Critères D1 à D10 vérifiés par le chef de projet ; `git log --oneline v3/backend..HEAD | wc -l` ≥ 10 (au moins un commit par ticket).

---

## 2. Lot 1 — SQL : runner, migrations, seeds

- **Objectif** : une base PostgreSQL 16 entièrement créée et remplie par des fichiers SQL versionnés,
  appliqués par un runner minimal, avec le contenu du CV (novembre 2026) en FR et EN.
- **Dépendances** : lot 0 fusionné dans `v3/backend`.
- **Agent responsable** : Dev base de données (branche `lot/1-sql`).
- **Périmètre autorisé** : `db/**`, `apps/api/src/infrastructure/db/**`, `apps/api/src/cli/**`,
  `apps/api/test/e2e/db/**`, `docs/comptes-rendus/lot-1-*.md`, `docs/traductions-a-relire.md`.
- **Source du contenu** : `../personnalWebsite_V2/.claude/BRIEF-site-perso-v2.md`, section « Données du CV »
  (hors repo ; l'e-mail et le téléphone qui y figurent ne sont jamais recopiés).

### L1-01 — Runner de migrations minimal

- **Description** : `apps/api/src/infrastructure/db/migrations-runner.ts` : crée si besoin
  `schema_migrations (version text primary key, name text not null, checksum text not null, applied_at
  timestamptz not null default now())`, lit `db/migrations/*.sql` triés par nom (préfixe `NNNN`), refuse
  deux fichiers de même préfixe, applique chaque fichier non encore appliqué dans une transaction
  (`begin` … insertion dans `schema_migrations` … `commit`, `rollback` en cas d'erreur), compare le
  checksum SHA-256 des fichiers déjà appliqués et échoue si un fichier appliqué a été modifié. Verrou
  `pg_advisory_lock` pendant l'exécution. Journal : une ligne par fichier (appliqué / déjà appliqué).
  Aucune dépendance Nest.
- **Fichiers** : `apps/api/src/infrastructure/db/migrations-runner.ts`, `apps/api/src/cli/migrate.ts`, `apps/api/src/infrastructure/db/migrations-runner.spec.ts`.
- **Critères d'acceptation** :
  - `pnpm db:migrate` passe deux fois de suite ; la seconde exécution affiche « déjà appliquée » pour chaque fichier et `schema_migrations` n'a pas de doublon.
  - Test e2e `migrations-runner.e2e.ts` sur `postgres_test` : un fichier SQL invalide placé dans un répertoire temporaire fait échouer le runner et aucune ligne n'est insérée dans `schema_migrations` (rollback) ; un fichier appliqué puis modifié provoque une erreur « checksum ».
  - `psql "$DATABASE_URL" -Atc "select count(*) from schema_migrations"` = nombre de fichiers dans `db/migrations/`.

### L1-02 — Runner de seeds idempotents

- **Description** : `seeds-runner.ts` : lit `db/seeds/*.sql` triés, exécute chaque fichier dans une
  transaction à chaque appel (les seeds sont idempotents par `on conflict (slug) do update`, pas de table de
  suivi), échoue si une migration est en attente. `pnpm db:seed` et `pnpm db:reset` (drop schema public
  cascade + migrate + seed, refusé si `NODE_ENV=production`).
- **Fichiers** : `apps/api/src/infrastructure/db/seeds-runner.ts`, `apps/api/src/cli/{seed.ts,reset.ts}`.
- **Critères d'acceptation** :
  - `pnpm db:seed && pnpm db:seed` passe ; `psql "$DATABASE_URL" -Atc "select count(*) from experiences"` identique avant et après la seconde exécution.
  - `NODE_ENV=production pnpm db:reset` échoue avec un message explicite.

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
  - `psql "$DATABASE_URL" -Atc "select enum_range(null::experience_kind)"` = `{employment,freelance,break,mentoring}`.
  - `psql "$DATABASE_URL" -c "insert into profile (id, first_name, last_name, picture_path, location) values (2,'a','b','c','d')"` échoue (check id = 1).
  - `psql "$DATABASE_URL" -c "insert into profile_translations (profile_id, locale, title, headline, bio, availability, picture_alt) values (1,'de','t','h','b','a','p')"` échoue (locale).

### L1-04 — Migration : `skill_groups`, `skills`

- **Description** : `0004_skills.sql` : `skill_groups` (slug unique, sort_order, published), `skill_groups_translations`
  (name, description), `skills` (slug unique, `group_id` FK `on delete restrict`, `level smallint check
  (level between 1 and 5)`, `icon text`, `icon_path text null`, sort_order, published, index `(group_id,
  published, sort_order)`), `skills_translations (name)`.
- **Fichiers** : `db/migrations/0004_skills.sql`.
- **Critères d'acceptation** :
  - `psql "$DATABASE_URL" -c "insert into skills (slug, group_id, level, icon) values ('x', 1, 6, 'x')"` échoue (check level).
  - `psql "$DATABASE_URL" -Atc "select indexname from pg_indexes where tablename='skills'"` contient un index sur `(group_id, published, sort_order)`.

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
  - `psql "$DATABASE_URL" -Atc "select data_type from information_schema.columns where table_name='experiences_translations' and column_name='achievements'"` = `ARRAY`.

### L1-06 — Migration : `projects`, `tools`, `resources`

- **Description** : `0006_projects_tools_resources.sql` conforme à `docs/01` : `projects` (slug, url null,
  repo_url null, image_desktop_path null, image_mobile_path null, `year smallint null`, sort_order, published),
  `projects_translations` (title, description, image_alt null), `project_skills` PK composite ; `tools`
  (slug, url null, icon_path null, …), `tools_translations` (name, family, description) ; `resources`
  (slug, url, `group_id` FK `skill_groups` null `on delete set null`, picture_path null, …),
  `resources_translations` (name, description, picture_alt null). Index `(published, sort_order)` partout.
- **Fichiers** : `db/migrations/0006_projects_tools_resources.sql`.
- **Critères d'acceptation** :
  - `psql "$DATABASE_URL" -Atc "select table_name from information_schema.tables where table_schema='public' order by 1"` contient `projects`, `projects_translations`, `project_skills`, `tools`, `tools_translations`, `resources`, `resources_translations`.
  - Suppression d'un `skill_groups` référencé par une `resources` met `group_id` à null (test e2e).

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
  - `psql "$DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema='public' and table_name <> 'schema_migrations'"` = 24 (13 tables de contenu : `profile`, `social_links`, `skill_groups`, `skills`, `experiences`, `experience_skills`, `projects`, `project_skills`, `tools`, `resources`, `certifications`, `education`, `languages` ; 11 tables `_translations`).

### L1-08 — Schéma Drizzle dérivé du SQL

- **Description** : `apps/api/src/infrastructure/db/schema/*.ts` : une définition Drizzle (`pgTable`,
  `pgEnum`) par table, recopiée du SQL (noms snake_case, types, nullabilité, enums). Aucun `drizzle-kit
  generate` ni `push` : le SQL reste la source de vérité. Test e2e qui compare, pour chaque table Drizzle,
  la liste `(colonne, type, nullable)` avec `information_schema.columns` de la base migrée, et échoue à la
  moindre divergence ou table manquante.
- **Fichiers** : `apps/api/src/infrastructure/db/schema/{index.ts,enums.ts,profile.ts,social-links.ts,skills.ts,experiences.ts,projects.ts,tools.ts,resources.ts,certifications.ts,education.ts,languages.ts}`, `apps/api/test/e2e/db/schema-matches-db.e2e.ts`.
- **Critères d'acceptation** :
  - `pnpm test:e2e -- schema-matches-db` passe.
  - `grep -rn "drizzle-kit" package.json apps/api/package.json` ne renvoie aucun script `generate`/`push`.

### L1-09 — Seed : profil et liens sociaux (FR + EN)

- **Description** : `db/seeds/0001_profile.sql` : ligne `profile` id 1 (prénom, nom, `picture_path`
  `/images/profile/portrait.jpg`, localisation du CV), traductions `fr` (titre, accroche, bio = paragraphe
  « Profil » du CV, disponibilité, `picture_alt` descriptif « Portrait de … ») et `en` (traduction par
  l'agent, bloc précédé du commentaire `-- EN : à relire`). `db/seeds/0002_social_links.sql` : `linkedin`
  (URL du CV), `github` et `website` si connus (sinon absents : point ouvert P1). Jamais d'e-mail ni de
  téléphone. Upsert `on conflict (slug) do update` (et `on conflict (profile_id, locale)` pour les traductions).
- **Fichiers** : `db/seeds/0001_profile.sql`, `db/seeds/0002_social_links.sql`.
- **Critères d'acceptation** :
  - `psql "$DATABASE_URL" -Atc "select count(*) from profile_translations"` = 2 et `select count(*) from profile` = 1.
  - `psql "$DATABASE_URL" -Atc "select count(*) from social_links where kind in ('email','phone') or url ~* 'mailto:|tel:'"` = 0.
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
  - `psql "$DATABASE_URL" -Atc "select count(*) from skill_groups"` = 7 ; `select count(*) from skills` ≥ 30.
  - `psql "$DATABASE_URL" -Atc "select count(*) from skills s where not exists (select 1 from skills_translations t where t.skill_id=s.id and t.locale='fr')"` = 0 (toute compétence a sa traduction `fr`).

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
  - `psql "$DATABASE_URL" -Atc "select count(*) from experiences"` = 8 ; `select count(*) from experiences where kind='break'` = 1 ; `select count(*) from experiences where kind='break' and company is not null` = 0.
  - `psql "$DATABASE_URL" -Atc "select count(*) from experiences_translations where locale='fr' and cardinality(achievements) > 0"` ≥ 5.
  - `psql "$DATABASE_URL" -Atc "select count(*) from experiences_translations where locale='en'"` = 8.
  - `psql "$DATABASE_URL" -Atc "select count(*) from experiences e where not exists (select 1 from experience_skills es where es.experience_id = e.id) and e.kind <> 'break'"` = 0.
  - `grep -c "EN : à relire" db/seeds/0004_experiences.sql` ≥ 8.

### L1-12 — Seed : certifications, formation, langues

- **Description** : `db/seeds/0005_certifications_education_languages.sql` : 3 certifications du CV
  (émetteur, année), formation (autodidacte + EEMI 2016 + parcours OpenClassrooms 2015, en 1 à 3 lignes
  `education` selon le choix documenté), langues `fr` (langue maternelle, `cefr_level` null) et `en`
  (`C1`, « professionnel »). Traductions FR + EN (`-- EN : à relire`). `projects`, `tools`, `resources` : pas
  de seed (point ouvert P5), les tables restent vides et l'API renvoie `[]`.
- **Fichiers** : `db/seeds/0005_certifications_education_languages.sql`.
- **Critères d'acceptation** :
  - `psql "$DATABASE_URL" -Atc "select count(*) from certifications"` = 3 ; `select count(*) from languages` = 2 ; `select count(*) from education` ≥ 1.
  - `psql "$DATABASE_URL" -Atc "select cefr_level from languages where code='en'"` = `C1`.

### L1-13 — Tests d'idempotence, de couverture des traductions et d'absence de données personnelles

- **Description** : test e2e `seeds.e2e.ts` sur `postgres_test` : `reset` puis `seed` deux fois ; les
  comptages de toutes les tables sont identiques entre les deux passes ; chaque entité publiée possède une
  traduction `fr` ; chaque colonne `*_alt` non nulle pour les entités ayant un chemin d'image ; aucune
  valeur de colonne texte ne matche les regex e-mail / téléphone ; toute `url` commence par `https://`.
- **Fichiers** : `apps/api/test/e2e/db/seeds.e2e.ts`.
- **Critères d'acceptation** :
  - `pnpm test:e2e -- seeds` passe.
  - `git grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|(\+33|0)[1-9]([ .-]?[0-9]{2}){4}" -- db/` ne renvoie rien.

### L1-14 — Liste des traductions à relire et compte rendu

- **Description** : `docs/traductions-a-relire.md` : tableau (fichier, slug, colonne, texte FR, texte EN
  proposé) de toutes les traductions produites par l'agent, à relire par Julien.
  `docs/comptes-rendus/lot-1-dev-db.md`.
- **Fichiers** : `docs/traductions-a-relire.md`, `docs/comptes-rendus/lot-1-dev-db.md`.
- **Critères d'acceptation** :
  - `grep -c "EN : à relire" db/seeds/*.sql` = nombre de lignes du tableau de `docs/traductions-a-relire.md` (hors en-tête).
  - Critères D1 à D10.

---

## 3. Lot 2 — Contrats : schémas Zod, types, OpenAPI

- **Objectif** : `packages/contracts` décrit entièrement l'API en lecture seule (chaque ressource, `/cv`,
  `/health`, erreurs) sous forme de schémas Zod, de types exportés et d'un document OpenAPI 3.1 servi tel
  quel par l'API et honoré à l'identique par le futur portage Rust.
- **Dépendances** : lot 0 fusionné. Indépendant du lot 1 (parallèle).
- **Agent responsable** : Dev contrats (branche `lot/2-contrats`).
- **Périmètre autorisé** : `packages/contracts/**`, `docs/comptes-rendus/lot-2-*.md`.

### L2-01 — Schémas communs

- **Description** : `src/common/` : `LocaleSchema` (`z.enum(['fr','en'])`), `LangQuerySchema`
  (`{ lang: LocaleSchema.default('fr') }`), `SlugSchema` (`^[a-z0-9]+(-[a-z0-9]+)*$`), `IsoDateSchema`
  (`YYYY-MM-DD`), `ImageSchema` (`{ path: string, alt: string }`), enums `ExperienceKindSchema`,
  `ContractTypeSchema`, `WorkModeSchema`, `CefrLevelSchema`, `ProblemDetailsSchema` (déjà présent, complété),
  `HealthResponseSchema`. Enregistrement OpenAPI de chaque schéma avec `.openapi('Nom')` et exemples.
- **Fichiers** : `packages/contracts/src/common/*.ts`, tests `*.spec.ts`.
- **Critères d'acceptation** :
  - `pnpm --filter @v3/contracts test` passe : `LangQuerySchema.parse({})` → `{ lang: 'fr' }` ; `LangQuerySchema.safeParse({ lang: 'de' }).success` = false ; `SlugSchema` rejette `Foo_bar`.

### L2-02 — Schémas `profile`, `social-links`, `skills`, `skill-groups`

- **Description** : `ProfileSchema` (`firstName`, `lastName`, `location`, `picture: ImageSchema`, `title`,
  `headline`, `bio`, `availability` ; aucun champ e-mail/téléphone), `SocialLinkSchema` (`slug`, `kind`,
  `url`, `label`), `SkillSchema` (`slug`, `name`, `level` 1-5, `icon`, `iconPath` null, `groupSlug`),
  `SkillGroupSchema` (`slug`, `name`, `description`, `skills: SkillSchema[]`). Réponses : objet pour
  `/profile`, tableau pour les autres. Les objets de réponse sont `strict` (clé inconnue refusée) afin que
  les tests e2e détectent toute fuite de colonne.
- **Fichiers** : `packages/contracts/src/resources/{profile,social-links,skills,skill-groups}.ts`, specs.
- **Critères d'acceptation** :
  - Tests : un exemple valide par schéma passe ; `ProfileSchema.safeParse({ ...valid, email: 'contact@example.com' }).success` = false.
  - `grep -nEi "email|phone|tel\b" packages/contracts/src/resources/profile.ts` ne renvoie rien.

### L2-03 — Schémas `experiences`, `projects`, `tools`, `resources`

- **Description** : `ExperienceSchema` (`slug`, `kind`, `company` null, `companyUrl` null, `logo: ImageSchema |
  null`, `contractType` null, `workMode` null, `dateStart`, `dateEnd` null, `jobTitle`, `location` null,
  `summary`, `achievements: string[]`, `stackLabel` null, `skills: SkillSchema[]`), `ProjectSchema` (`slug`,
  `url`, `repoUrl`, `imageDesktop`, `imageMobile` (`ImageSchema | null`), `year`, `title`, `description`,
  `skills`), `ToolSchema` (`slug`, `url`, `iconPath`, `name`, `family`, `description`), `ResourceSchema`
  (`slug`, `url`, `groupSlug` null, `picture: ImageSchema | null`, `name`, `description`).
- **Fichiers** : `packages/contracts/src/resources/{experiences,projects,tools,resources}.ts`, specs.
- **Critères d'acceptation** :
  - Tests : une expérience `kind: 'break'` avec `company: null` passe ; `dateStart: '2026-13-01'` est rejeté ; `achievements` doit être un tableau (chaîne rejetée).

### L2-04 — Schémas `certifications`, `education`, `languages`

- **Description** : `CertificationSchema` (`slug`, `issuer`, `year`, `url` null, `name`), `EducationSchema`
  (`slug`, `institution`, `yearStart`, `yearEnd` null, `url` null, `title`, `description`), `LanguageSchema`
  (`slug`, `code`, `cefrLevel` null, `name`, `levelLabel`).
- **Fichiers** : `packages/contracts/src/resources/{certifications,education,languages}.ts`, specs.
- **Critères d'acceptation** :
  - Tests : `LanguageSchema` rejette `cefrLevel: 'Z9'` ; `EducationSchema` rejette `yearEnd < yearStart` (raffinement).

### L2-05 — Schéma de l'agrégat `/cv`

- **Description** : `CvSchema` = `{ locale, profile, socialLinks, skillGroups, experiences, projects, tools,
  resources, certifications, education, languages }` composé des schémas précédents (`skills` n'est pas
  répété à plat : il est imbriqué dans `skillGroups`). Export `CvResponse` typé.
- **Fichiers** : `packages/contracts/src/resources/cv.ts`, spec.
- **Critères d'acceptation** :
  - Test : un exemple complet passe ; l'absence de `languages` est rejetée ; une clé supplémentaire est rejetée.

### L2-06 — Registre OpenAPI 3.1 complet

- **Description** : `src/openapi/registry.ts` enregistre les 13 routes (`GET /api/v1/{profile, social-links,
  skill-groups, skills, experiences, projects, tools, resources, certifications, education, languages, cv}`
  et `GET /api/v1/health`) avec le paramètre de requête `lang` (sauf `/health`), les réponses `200`
  (`application/json`, schéma de la ressource), `400` et `404` (`application/problem+json`,
  `ProblemDetails`), `429` pour toutes. `info` (titre, version `1.0.0`, description en français), `servers`
  relatif (`/`). `openapi:generate` écrit `openapi/openapi.json` (commité) de façon déterministe (clés
  triées, indentation 2). Test : le JSON généré est validé par un validateur OpenAPI 3.1 et identique au
  fichier commité.
- **Fichiers** : `packages/contracts/src/openapi/{registry.ts,generate.ts,openapi.spec.ts}`, `packages/contracts/openapi/openapi.json`.
- **Critères d'acceptation** :
  - `pnpm --filter @v3/contracts openapi:generate && git diff --exit-code packages/contracts/openapi/openapi.json` passe (fichier à jour).
  - `node -e "const o=require('./packages/contracts/openapi/openapi.json');const p=Object.keys(o.paths);process.exit(p.length===13&&p.every(k=>k.startsWith('/api/v1/'))?0:1)"` passe.
  - Test de validation OpenAPI 3.1 passe ; `grep -c '"lang"' packages/contracts/openapi/openapi.json` ≥ 12.

### L2-07 — Exports, types et compte rendu

- **Description** : `src/index.ts` exporte tous les schémas, les types `z.infer` (`Profile`, `SocialLink`,
  …, `Cv`, `ProblemDetails`, `Locale`), les enums en constantes (`LOCALES`, `EXPERIENCE_KINDS`, …) et
  `openApiDocument` (objet) ; `package.json` avec `exports` (`.`, `./openapi.json`), `types`, `sideEffects:
  false`. Compte rendu `docs/comptes-rendus/lot-2-dev-contrats.md`.
- **Fichiers** : `packages/contracts/src/index.ts`, `packages/contracts/package.json`, compte rendu.
- **Critères d'acceptation** :
  - `node -e "import('@v3/contracts').then(m=>process.exit(['ProfileSchema','CvSchema','ProblemDetailsSchema','LangQuerySchema','openApiDocument'].every(k=>k in m)?0:1))"` passe depuis `apps/api` après `pnpm build`.
  - `pnpm --filter @v3/api typecheck` passe avec un import de type `Cv` depuis `@v3/contracts` (vérifié par un fichier `.d.ts` de test dans contracts : `expectTypeOf`).
  - Critères D1 à D10.

---

## 4. Lot 3 — API : 12 modules en deux agents parallèles

- **Objectif** : chaque route du contrat répond avec des données issues de PostgreSQL via Drizzle, dans la
  langue demandée avec repli `en → fr`, triées par `sort_order` (ou `date_start desc` pour les
  expériences), limitées au contenu `published`, et validées par les schémas Zod des contrats avant envoi.
- **Dépendances** : lots 1 et 2 fusionnés dans `v3/backend`.
- **Agents responsables** : Dev API A (branche `lot/3-api-a`) et Dev API B (branche `lot/3-api-b`), en
  parallèle, périmètres disjoints.
- **Répartition** (6 modules chacun, équilibrée par complexité : A reçoit `experiences` et `skill-groups`
  imbriqué, B reçoit `cv` et `projects`) :

| Agent | Modules | Périmètre de fichiers |
|---|---|---|
| A | `profile`, `social-links`, `skills`, `skill-groups`, `experiences`, `languages` + route `openapi.json` | `apps/api/src/modules/{profile,social-links,skills,skill-groups,experiences,languages}/**`, `apps/api/src/modules/openapi/**`, `apps/api/test/e2e/{profile,social-links,skills,skill-groups,experiences,languages,openapi}.e2e.ts`, `docs/comptes-rendus/lot-3-dev-api-a.md` |
| B | `projects`, `tools`, `resources`, `certifications`, `education`, `cv` | `apps/api/src/modules/{projects,tools,resources,certifications,education,cv}/**`, `apps/api/test/e2e/{projects,tools,resources,certifications,education,cv}.e2e.ts`, `docs/comptes-rendus/lot-3-dev-api-b.md` |

- **Patron commun à chaque module** (identique pour A et B, imposé par `CLAUDE.md`) :
  - `domain/<resource>.ts` : types métier (dérivés des types de `@v3/contracts`), port
    `<Resource>Repository` (interface, ex. `findAllPublished(locale): Promise<Experience[]>` /
    `findProfile(locale): Promise<Profile | null>`), sans dépendance Nest ni Drizzle.
  - `application/list-<resource>.use-case.ts` (ou `get-profile.use-case.ts`) : classe sans décorateur,
    reçoit le port par constructeur, applique le repli de locale avec `pickTranslation`, retourne le type
    du contrat.
  - `infrastructure/db/drizzle-<resource>.repository.ts` : requêtes Drizzle (jointure des deux locales en
    une requête : `left join … and locale = 'en'` + `join … and locale = 'fr'`), filtre `published = true`,
    tri `sort_order asc, id asc`.
  - `infrastructure/http/<resource>.controller.ts` + `<resource>.module.ts` : contrôleur Nest, parse `?lang`
    avec `LangQuerySchema` (400 problem+json sinon), appelle le cas d'usage, valide la réponse avec le
    schéma du contrat (`strict`) avant de la renvoyer, 404 problem+json si `/profile` n'a pas de ligne.
  - Tests unitaires du cas d'usage avec un dépôt en mémoire (repli, tri, filtrage) ; test e2e du module
    contre le Postgres de test seedé (`fr`, `en`, repli, forme de la réponse validée par le schéma Zod).
- **Signatures des cas d'usage** (fixées ici pour que `cv` de l'agent B puisse composer ceux de l'agent A
  sans attendre) : `GetProfileUseCase.execute(locale)`, `ListSocialLinksUseCase.execute(locale)`,
  `ListSkillGroupsUseCase.execute(locale)`, `ListSkillsUseCase.execute(locale)`,
  `ListExperiencesUseCase.execute(locale)`, `ListProjectsUseCase.execute(locale)`,
  `ListToolsUseCase.execute(locale)`, `ListResourcesUseCase.execute(locale)`,
  `ListCertificationsUseCase.execute(locale)`, `ListEducationUseCase.execute(locale)`,
  `ListLanguagesUseCase.execute(locale)`. Chaque module exporte son cas d'usage comme provider Nest
  (`exports` du module) sous son nom de classe.

### L3-01 (A) — Module `profile`

- **Description** : `GET /api/v1/profile` selon le patron commun. 404 problem+json si aucune ligne.
- **Fichiers** : `apps/api/src/modules/profile/**`, `apps/api/test/e2e/profile.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : `GET /api/v1/profile` → 200, corps validé par `ProfileSchema` strict ; `?lang=en` → `title` en anglais ; après suppression de la ligne `en` dans le test → `?lang=en` renvoie le `fr` ; `?lang=de` → 400 problem+json.
  - `curl -s http://localhost:3000/api/v1/profile | grep -ciE "@|tel"` = 0.

### L3-02 (A) — Module `social-links`

- **Description** : `GET /api/v1/social-links`, tableau trié par `sort_order`, `published` seulement.
- **Fichiers** : `apps/api/src/modules/social-links/**`, `apps/api/test/e2e/social-links.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : 200, tableau validé par `z.array(SocialLinkSchema)` ; un lien mis `published=false` dans le test disparaît ; ordre = `sort_order`.

### L3-03 (A) — Module `skills`

- **Description** : `GET /api/v1/skills`, tableau plat avec `groupSlug`, tri par `sort_order`.
- **Fichiers** : `apps/api/src/modules/skills/**`, `apps/api/test/e2e/skills.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : 200, ≥ 30 éléments validés par `SkillSchema` ; `en` identique au `fr` pour un nom propre ; une compétence non publiée est exclue.

### L3-04 (A) — Module `skill-groups` (skills imbriqués)

- **Description** : `GET /api/v1/skill-groups` : groupes publiés triés, chacun avec ses `skills` publiés
  triés, en au plus deux requêtes (pas de N+1).
- **Fichiers** : `apps/api/src/modules/skill-groups/**`, `apps/api/test/e2e/skill-groups.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : 7 groupes validés par `SkillGroupSchema` ; un groupe non publié disparaît avec ses compétences ; test unitaire du dépôt comptant les requêtes exécutées ≤ 2 (via un logger Drizzle de test).

### L3-05 (A) — Module `experiences` (skills, enums, tri par date)

- **Description** : `GET /api/v1/experiences` : tri `date_start desc`, `achievements` en tableau, `skills`
  imbriqués triés par `experience_skills.sort_order`, dates au format `YYYY-MM-DD`, `logo` null si pas de
  `logo_path`.
- **Fichiers** : `apps/api/src/modules/experiences/**`, `apps/api/test/e2e/experiences.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : 8 éléments validés par `ExperienceSchema` ; le premier est le plus récent ; l'élément `kind: 'break'` a `company: null` et `stackLabel` « Huile de coude » ; `?lang=en` renvoie les `achievements` anglais ; repli vers `fr` vérifié sur une expérience sans `en`.

### L3-06 (A) — Module `languages`

- **Description** : `GET /api/v1/languages`.
- **Fichiers** : `apps/api/src/modules/languages/**`, `apps/api/test/e2e/languages.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : 2 éléments validés par `LanguageSchema` ; `cefrLevel` `C1` pour `en`, null pour `fr`.

### L3-07 (A) — Route `GET /api/v1/openapi.json`

- **Description** : module `openapi` servant `openApiDocument` de `@v3/contracts` en `application/json`,
  avec `cache-control: public, max-age=3600`. La route est une méta-route hors contrat : elle n'apparaît
  pas dans `paths` du document OpenAPI (décision à consigner dans le compte rendu).
- **Fichiers** : `apps/api/src/modules/openapi/**`, `apps/api/test/e2e/openapi.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : 200, corps strictement égal (`deepEqual`) au contenu de `packages/contracts/openapi/openapi.json`.

### L3-08 (B) — Module `projects` (skills imbriqués)

- **Description** : `GET /api/v1/projects`, `skills` via `project_skills`, images en `ImageSchema | null`.
- **Fichiers** : `apps/api/src/modules/projects/**`, `apps/api/test/e2e/projects.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : 200 et `[]` sur la base seedée ; avec une fixture insérée dans le test (projet + 2 skills, `en` absent) : 1 élément validé par `ProjectSchema`, `skills` triés, repli `fr` sur `?lang=en`.

### L3-09 (B) — Module `tools`

- **Description** : `GET /api/v1/tools`.
- **Fichiers** : `apps/api/src/modules/tools/**`, `apps/api/test/e2e/tools.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : `[]` sur base seedée ; avec fixture : validé par `ToolSchema`, filtrage `published`, tri.

### L3-10 (B) — Module `resources`

- **Description** : `GET /api/v1/resources`, `groupSlug` résolu par jointure sur `skill_groups` (null si
  pas de groupe).
- **Fichiers** : `apps/api/src/modules/resources/**`, `apps/api/test/e2e/resources.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : `[]` sur base seedée ; avec fixture rattachée à un groupe : `groupSlug` renseigné ; sans groupe : null.

### L3-11 (B) — Module `certifications`

- **Description** : `GET /api/v1/certifications`.
- **Fichiers** : `apps/api/src/modules/certifications/**`, `apps/api/test/e2e/certifications.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : 3 éléments validés par `CertificationSchema`, tri `sort_order`, `en` présent et repli testé.

### L3-12 (B) — Module `education`

- **Description** : `GET /api/v1/education`.
- **Fichiers** : `apps/api/src/modules/education/**`, `apps/api/test/e2e/education.e2e.ts`.
- **Critères d'acceptation** :
  - e2e : ≥ 1 élément validé par `EducationSchema`, `yearEnd` null accepté.

### L3-13 (B) — Module `cv` (agrégat)

- **Description** : `GET /api/v1/cv` : `GetCvUseCase` compose les 10 cas d'usage listés (injectés par
  Nest via les `exports` des modules), exécution en parallèle (`Promise.all`), réponse validée par
  `CvSchema` strict, `locale` effective dans le corps. Tests unitaires avec des doublures des cas d'usage
  (l'agent B n'attend pas le code de l'agent A) ; test e2e exécutable seulement après fusion des deux
  branches : le chef de projet le lance à l'intégration.
- **Fichiers** : `apps/api/src/modules/cv/**`, `apps/api/test/e2e/cv.e2e.ts`.
- **Critères d'acceptation** :
  - Unitaire : `GetCvUseCase` renvoie un objet validé par `CvSchema` à partir de doublures ; une doublure qui rejette fait rejeter l'ensemble (pas de réponse partielle).
  - e2e (après fusion A + B) : `GET /api/v1/cv` → 200, validé par `CvSchema` ; `cv.experiences` égal à la réponse de `/experiences` ; `?lang=en` → `locale: 'en'`.
  - Temps de réponse de `/cv` sur base seedée < 200 ms en local (mesuré dans le test e2e, seuil indicatif).

### L3-14 (A et B) — Comptes rendus

- **Description** : chaque agent livre `docs/comptes-rendus/lot-3-dev-api-{a,b}.md`.
- **Critères d'acceptation** : critères D1 à D10 sur chaque branche ; `git diff --stat v3/backend..lot/3-api-a` et `...lot/3-api-b` ne listent aucun fichier commun (périmètres disjoints vérifiés par `comm -12`).

---

## 5. Lot 4 — QA

- **Objectif** : une suite e2e exhaustive et reproductible contre le Postgres Docker de test, couvrant
  chaque endpoint dans les deux langues, le repli, les erreurs, la sécurité HTTP et la conformité des
  réponses au document OpenAPI, plus les tests unitaires manquants.
- **Dépendances** : lot 3 (A et B) fusionné.
- **Agent responsable** : QA (branche `lot/4-qa`).
- **Périmètre autorisé** : `apps/api/test/**`, `apps/api/src/**/*.spec.ts`, `apps/api/vitest.config.ts`,
  `docs/comptes-rendus/lot-4-*.md`. Les bugs trouvés sont consignés (pas corrigés par la QA sauf
  trivialité dans un test) et transmis au lot 6.

### L4-01 — Harnais e2e commun

- **Description** : `test/e2e/helpers/` : démarrage unique de l'app par fichier, `resetDatabase()`
  (migrate + seed sur `postgres_test`), `withFixture()` (insertion dans une transaction annulée en fin de
  test), `expectProblem(res, status)` (vérifie `content-type` et `ProblemDetailsSchema`), `validate(schema,
  body)`. Table de paramétrage `ENDPOINTS` (12 routes, schéma associé, compteur attendu sur base seedée).
- **Fichiers** : `apps/api/test/e2e/helpers/*.ts`.
- **Critères d'acceptation** :
  - `pnpm test:e2e` passe deux fois de suite sans intervention (reproductibilité).

### L4-02 — Matrice endpoints × langues × repli

- **Description** : test paramétré sur `ENDPOINTS` : pour chaque route, `sans lang` = `fr`, `?lang=fr`,
  `?lang=en`, `?lang=EN` (400 ou normalisation : trancher selon le contrat, qui impose `fr|en` minuscule
  → 400), `?lang=de` → 400, `?lang=` → 400 ; repli : suppression de toutes les lignes `en` de la table
  concernée dans la fixture puis `?lang=en` égal à `?lang=fr` champ par champ.
- **Fichiers** : `apps/api/test/e2e/matrix.e2e.ts`.
- **Critères d'acceptation** :
  - Le test couvre les 12 routes (assertion `expect(ENDPOINTS).toHaveLength(12)`), passe, et le rapport Vitest liste ≥ 72 cas (12 × 6).

### L4-03 — Filtrage `published` et tri

- **Description** : pour chaque ressource en liste : une fixture non publiée n'apparaît ni dans la route
  dédiée ni dans `/cv` ; un `sort_order` modifié change l'ordre ; `experiences` triées `dateStart desc`.
- **Fichiers** : `apps/api/test/e2e/published-and-order.e2e.ts`.
- **Critères d'acceptation** : passe ; 10 ressources en liste couvertes.

### L4-04 — Erreurs et routes

- **Description** : 404 problem+json sur `/api/v1/inconnu`, `/api/v1/profile/1`, `/inconnu`, `/api/v2/cv` ;
  405 ou 404 (selon Fastify, à consigner) sur `POST /api/v1/profile` ; `HEAD` et `OPTIONS` cohérents ;
  corps d'erreur sans stack trace ni message interne (`detail` générique en 500 simulé via une doublure de
  dépôt qui lève) ; `instance` = chemin demandé.
- **Fichiers** : `apps/api/test/e2e/errors.e2e.ts`.
- **Critères d'acceptation** : passe ; aucune réponse d'erreur ne contient `at ` suivi d'un chemin de fichier (`/apps/api/`).

### L4-05 — En-têtes de sécurité, CORS, rate limiting

- **Description** : sur chaque route : `x-content-type-options: nosniff`, `x-frame-options: DENY` (ou
  `SAMEORIGIN`, à consigner), `content-security-policy` avec `default-src 'none'`, `referrer-policy`,
  `strict-transport-security`, absence de `x-powered-by` et de `server` détaillé ; CORS : `Origin` =
  `CORS_ORIGIN` → `access-control-allow-origin` égal, autre origine → absent ; preflight `OPTIONS` n'autorise
  que `GET` ; rate limiting : avec `RATE_LIMIT_MAX=3` injecté dans la config de test, la 4e requête dans la
  fenêtre → 429 problem+json avec `retry-after`.
- **Fichiers** : `apps/api/test/e2e/security.e2e.ts`.
- **Critères d'acceptation** : passe ; `curl -s -I -H "Origin: https://evil.example" http://localhost:3000/api/v1/health | grep -i access-control-allow-origin` vide.

### L4-06 — Conformité des réponses au document OpenAPI

- **Description** : pour chaque route et chaque langue, la réponse est validée (a) par le schéma Zod du
  contrat en mode strict et (b) par le schéma JSON correspondant extrait de `openapi/openapi.json`
  (validation Ajv 2020-12 avec `additionalProperties` forcé à false) ; les codes 400/404/429 sont déclarés
  dans le document pour la route ; `GET /api/v1/openapi.json` égal au fichier commité.
- **Fichiers** : `apps/api/test/e2e/openapi-conformance.e2e.ts`.
- **Critères d'acceptation** : passe pour 12 routes × 2 langues ; un champ ajouté artificiellement dans une réponse (doublure) fait échouer le test (test négatif inclus).

### L4-07 — Tests unitaires manquants et seuil de couverture

- **Description** : compléter les unitaires des cas d'usage et de `pickTranslation`, du filtre problem+json,
  du parsing de config ; activer `coverage` (v8) avec seuils `lines 85`, `branches 75` sur `apps/api/src`
  hors `infrastructure/db/schema`.
- **Fichiers** : `apps/api/src/**/*.spec.ts`, `apps/api/vitest.config.ts`.
- **Critères d'acceptation** : `pnpm --filter @v3/api test:unit -- --coverage` passe avec les seuils.

### L4-08 — Rapport QA

- **Description** : `docs/comptes-rendus/lot-4-qa.md` : liste des anomalies trouvées (gravité, route,
  reproduction par commande), cas non couverts, décisions (405 vs 404, `x-frame-options`).
- **Critères d'acceptation** : critères D1 à D10 ; chaque anomalie référence un test rouge ou `skip` nommé `BUG-<n>`.

---

## 6. Lot 5 — DevOps

- **Objectif** : image Docker de production, compose de production derrière Caddy (TLS automatique, aucun
  port base exposé), script de premier déploiement sur le VPS, CI GitHub Actions.
- **Dépendances** : lot 0 fusionné pour démarrer ; vérification finale après fusion du lot 4.
- **Agent responsable** : DevOps (branche `lot/5-devops`).
- **Périmètre autorisé** : `docker/**` (sauf `compose.dev.yml` : modifications minimales et justifiées),
  `scripts/**`, `.github/**`, `.dockerignore`, `docs/deploiement.md`, `docs/comptes-rendus/lot-5-*.md`.

### L5-01 — Dockerfile multi-stage de l'API

- **Description** : `docker/api.Dockerfile` : étape `deps` (`node:22-alpine`, `corepack enable`, `pnpm
  install --frozen-lockfile`), `build` (`pnpm turbo build --filter=@v3/api...`), `prune` (`pnpm deploy
  --filter=@v3/api --prod`), `runtime` (`node:22-alpine`, utilisateur non root `node`, `NODE_ENV=production`,
  copie de `dist`, `node_modules` prunés et `db/`, `HEALTHCHECK` sur `/api/v1/health`, `CMD node
  dist/main.js`). `.dockerignore` strict. Image sans `pnpm`, sans sources TS, sans `.env`.
- **Fichiers** : `docker/api.Dockerfile`, `.dockerignore`.
- **Critères d'acceptation** :
  - `docker build -f docker/api.Dockerfile -t v3-api:test .` passe.
  - `docker run --rm v3-api:test sh -c 'id -u'` ≠ 0 ; `docker run --rm v3-api:test sh -c 'ls src 2>/dev/null; ls .env 2>/dev/null; which pnpm'` ne renvoie rien.
  - `docker image inspect v3-api:test --format '{{.Size}}'` < 300 Mo.
  - `docker run --rm -e PORT=3000 -e CORS_ORIGIN=https://example.com -e DATABASE_URL=postgres://u:p@h/d -e RATE_LIMIT_MAX=100 -e RATE_LIMIT_WINDOW_MS=60000 -p 127.0.0.1:3100:3000 -d v3-api:test && sleep 3 && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/v1/health` = 200.

### L5-02 — Compose de production avec Caddy

- **Description** : `docker/compose.prod.yml` : services `caddy` (ports 80/443, volumes `caddy_data`,
  `caddy_config`, `Caddyfile`), `api` (image construite, `expose: 3000` seulement, `depends_on` `migrate`
  terminé avec succès et `postgres` healthy, `restart: unless-stopped`), `migrate` (même image, commande
  `node dist/cli/migrate.js && node dist/cli/seed.js`, `restart: no`), `postgres` (`postgres:16-alpine`,
  volume nommé, aucun port publié, healthcheck), réseau interne. `web` : service réservé (commenté ou
  image placeholder statique) en attendant le front. `docker/Caddyfile` : site `{$SITE_DOMAIN}`,
  `reverse_proxy /api/* api:3000`, `encode gzip zstd`, en-têtes de sécurité complémentaires, `/` renvoie
  une page statique minimale sans donnée personnelle tant que le front n'existe pas. Variables dans
  `docker/.env.prod.example` (placeholders).
- **Fichiers** : `docker/compose.prod.yml`, `docker/Caddyfile`, `docker/.env.prod.example`, `docker/placeholder/index.html`.
- **Critères d'acceptation** :
  - `docker compose -f docker/compose.prod.yml --env-file docker/.env.prod.example config` passe.
  - `docker compose -f docker/compose.prod.yml --env-file docker/.env.prod.example config | grep -A3 'postgres:' | grep -c 'ports:'` = 0 (aucun port base exposé) ; seul `caddy` publie des ports.
  - `docker run --rm -v "$PWD/docker/Caddyfile:/etc/caddy/Caddyfile" caddy:2 caddy validate --config /etc/caddy/Caddyfile` passe.
  - Test local : `SITE_DOMAIN=localhost docker compose -f docker/compose.prod.yml --env-file docker/.env.prod.example up -d --build` puis `curl -sk https://localhost/api/v1/health` = `{"status":"ok"}` et `curl -sk https://localhost/api/v1/cv | node -e "..."` validé par `CvSchema` (migrations et seeds passés par le service `migrate`).

### L5-03 — Script de premier déploiement VPS

- **Description** : `scripts/deploy/first-install.sh` (bash, `set -euo pipefail`, idempotent) : vérifie
  Docker et Compose, crée le dossier de déploiement, copie `.env.prod.example` en `.env.prod` si absent et
  s'arrête pour que l'opérateur le remplisse (mots de passe générés par `openssl rand`), construit ou tire
  l'image, lance `compose.prod.yml`, attend le healthcheck, affiche l'état. `scripts/deploy/update.sh` :
  `git pull`, rebuild, `up -d`, `migrate` relancé. Aucun secret dans le repo. `docs/deploiement.md` décrit
  la procédure et la sauvegarde/restauration de `postgres` (`pg_dump` via `docker compose exec`).
- **Fichiers** : `scripts/deploy/{first-install.sh,update.sh,backup.sh}`, `docs/deploiement.md`.
- **Critères d'acceptation** :
  - `bash -n scripts/deploy/*.sh` et `shellcheck scripts/deploy/*.sh` (via `docker run --rm -v "$PWD:/mnt" koalaman/shellcheck:stable scripts/deploy/*.sh`) passent.
  - Exécution à blanc dans un conteneur `docker:cli` ou sur l'hôte avec `DEPLOY_DIR=$(mktemp -d)` : le script s'arrête proprement à l'étape « remplir .env.prod » avec un code de sortie documenté, puis termine sur une seconde exécution avec un `.env.prod` rempli de valeurs de test.
  - Critère D7 sur `scripts/` et `docs/deploiement.md`.

### L5-04 — CI GitHub Actions

- **Description** : `.github/workflows/ci.yml` déclenché sur `push` et `pull_request` : job `qualite`
  (`actions/setup-node` 22 + cache pnpm via `corepack`, `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm typecheck`, `pnpm build`, `pnpm test:unit`), job `e2e` (service `postgres:16-alpine`,
  `DATABASE_URL_TEST` pointant dessus, `pnpm test:e2e`), job `docker` (`docker build` du Dockerfile, sans
  push), job `contrats` (`openapi:generate` puis `git diff --exit-code`). Concurrence annulant les runs
  obsolètes, permissions minimales (`contents: read`), actions épinglées par tag majeur.
- **Fichiers** : `.github/workflows/ci.yml`.
- **Critères d'acceptation** :
  - `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest` passe.
  - Exécution locale équivalente des quatre jobs (commandes listées dans le compte rendu) passe.
  - `grep -c "permissions:" .github/workflows/ci.yml` ≥ 1 et aucune étape `push` d'image ni secret référencé.

### L5-05 — Vérification finale et compte rendu

- **Description** : après fusion du lot 4, rejouer L5-01 à L5-04 sur `v3/backend`, puis
  `docs/comptes-rendus/lot-5-devops.md`.
- **Critères d'acceptation** : critères D1 à D10 ; `docker compose -f docker/compose.prod.yml ... down -v` laisse `docker ps -a | grep v3` vide.

---

## 7. Lot 6 — Revues indépendantes, corrections, recette

- **Objectif** : deux relectures adversariales du diff complet `master..v3/backend` (code et sécurité),
  menées sans connaître les conclusions l'une de l'autre, des findings vérifiés puis corrigés, et une
  recette finale par le chef de projet.
- **Dépendances** : lots 4 et 5 fusionnés.
- **Agents responsables** : Revue code, Revue sécurité (lecture seule, en parallèle), Agent corrections
  (branche `lot/6-corrections`), Chef de projet (recette).
- **Périmètre autorisé** : revues → `docs/revues/**` uniquement ; corrections → tout le repo sauf `docs/0*.md`
  et `docs/backlog.md`.

### L6-01 — Revue de code indépendante

- **Description** : relecture de `git diff master..v3/backend` : respect de l'architecture hexagonale,
  duplication entre modules A et B, gestion d'erreurs, N+1, typage (`any`, assertions), dette, lisibilité,
  conformité `CLAUDE.md`, pertinence des tests. Chaque finding : fichier, ligne, gravité (bloquant /
  majeur / mineur), scénario de défaillance, proposition. Sans accès à `docs/revues/securite-*.md`.
- **Fichiers** : `docs/revues/code-2026-11-<jj>.md`.
- **Critères d'acceptation** : fichier présent, chaque finding a un identifiant `RC-<n>` et une commande ou un test de reproduction ; `git diff --stat` de la branche de revue ne liste que `docs/revues/`.

### L6-02 — Revue de sécurité indépendante

- **Description** : même diff, angle sécurité : injection SQL (requêtes Drizzle paramétrées, pas de `sql.raw`
  sur entrée utilisateur), validation de `lang`, fuite d'informations (stack, versions, `server`),
  en-têtes, CORS, rate limiting, Dockerfile (utilisateur, surface), compose prod (ports, secrets, réseau),
  scripts de déploiement (`set -euo pipefail`, injection via variables), CI (permissions, épinglage),
  dépendances (`pnpm audit --prod`), données personnelles (grep e-mail/téléphone), absence d'endpoints
  d'écriture. Sans accès à `docs/revues/code-*.md`.
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
- **Critères d'acceptation** : critères D1 à D10 ; `git log --oneline v3/backend..lot/6-corrections | grep -cE "RC-|RS-"` = nombre de findings confirmés bloquants + majeurs ; tous les tests `BUG-<n>` du lot 4 passent (plus aucun `skip`).

### L6-05 — Recette finale du chef de projet

- **Description** : sur `v3/backend` après fusion : rejouer la séquence L0-10, `pnpm db:reset`, `pnpm test`,
  L5-02 (compose prod local), vérifier l'intégralité du contrat (13 routes), relire
  `docs/traductions-a-relire.md`, puis rédiger `docs/compte-rendu-2026-11-<jj>.md` : périmètre livré,
  écarts avec `docs/01` et `docs/02`, dette, points ouverts pour Julien, coût (tokens / durée si connus).
- **Critères d'acceptation** :
  - Séquence complète verte depuis un clone propre.
  - `docs/compte-rendu-2026-11-<jj>.md` présent avec les sections « Livré », « Non livré », « Décisions », « Points ouverts », « Dette ».
  - Point de contrôle 2 : attente de Julien.

---

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
| P8 | `lang` en majuscules (`?lang=EN`) : 400 ou normalisation ? | 400 (contrat strict `fr|en`). |
| P9 | `x-frame-options` `DENY` vs `SAMEORIGIN`, et CSP de l'API (`default-src 'none'`). | `DENY`, `default-src 'none'`. |
| P10 | Domaine du front pour `CORS_ORIGIN` et `SITE_DOMAIN` en production. | Placeholders `https://example.com` / `example.com`. |
| P11 | Doit-on garder `GET /api/v1/skills` à plat alors que `/skill-groups` les imbrique ? (docs/01 liste les deux.) | Conserver les deux, conformément à docs/01. |

### Risques identifiés

| # | Risque | Impact | Mitigation |
|---|---|---|---|
| R1 | TypeScript `latest` sur npm est la 7.x (compilateur natif) ; `typescript-eslint` exige `< 6.1`, et la chaîne NestJS/Vitest n'est pas validée dessus. | Lint ou build cassés au lot 0. | Épingler la dernière 6.0.x (`pnpm view typescript versions`) et le consigner dans le compte rendu du lot 0 ; revérifier à chaque lot. |
| R2 | Zod 4 : certains générateurs OpenAPI n'acceptent que Zod 4 (`@asteasolutions/zod-to-openapi` 9.x, `zod-openapi` 6.x) et l'API a changé par rapport à Zod 3. | Génération OpenAPI incomplète ou schémas 3.1 non conformes. | Choisir le générateur au lot 0 après un test de génération réel ; test de validation 3.1 au lot 2. |
| R3 | NestJS 12 + Fastify 5 : les plugins `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` doivent être enregistrés sur l'instance Fastify sous-jacente, pas via Express. | En-têtes absents, CORS inopérant. | Tests e2e d'en-têtes dès le lot 0 (L0-07), complétés au lot 4. |
| R4 | Repli de locale en SQL : jointure double (`fr` + `en`) sur chaque table de traduction, risque de N+1 ou d'oubli dans un module. | Réponses incohérentes entre modules A et B. | `pickTranslation` partagé (lot 0), patron de requête imposé (lot 3), matrice de repli (L4-02). |
| R5 | Parallélisme A/B au lot 3 : `cv` (B) dépend des cas d'usage de A. | `cv` non testable e2e avant fusion. | Signatures fixées dans ce backlog ; unitaires avec doublures ; e2e `cv` joué par le CdP à l'intégration. |
| R6 | Hook pre-commit lançant les e2e : lent et dépendant du Postgres de test démarré. | Agents tentés par `--no-verify`. | Message d'erreur explicite ; D6 exige la déclaration ; CI rejoue tout. |
| R7 | Traductions EN produites par un agent. | Qualité éditoriale. | Marquage « à relire » systématique et liste centralisée (L1-14). |
| R8 | Fuite de données personnelles par inadvertance (seed, fixtures, docs, `.env`). | Non négociable violé. | Critère D7 à chaque ticket, test L1-13, grep en revue sécurité. |
| R9 | Modification d'une migration déjà appliquée sur le VPS. | Divergence de schéma. | Checksum dans `schema_migrations` (L1-01), règle dans `db/migrations/README.md`. |
| R10 | Compose prod : Caddy sans front (`apps/web` différé). | Page d'accueil vide en production. | Placeholder statique minimal (L5-02), à remplacer lors du lot front. |
| R11 | Dérive entre `openapi.json` commité et schémas Zod. | Contrat faux pour le portage Rust. | Job CI `contrats` (`git diff --exit-code`) et test L4-06. |

## 9. Repères de versions (relevés le 18 novembre 2026, à revérifier avec `pnpm view <pkg> version`)

`@nestjs/core` 12.5.1 · `@nestjs/platform-fastify` 12.5.1 · `fastify` 5.12.8 · `drizzle-orm` 0.45.4 ·
`postgres` 4.1.1 · `zod` 4.6.7 · `@asteasolutions/zod-to-openapi` 9.1.0 · `zod-openapi` 6.0.2 · `vitest` 5.1.1 ·
`typescript` 7.0.2 (latest ; voir R1 : épingler 6.0.x) · `typescript-eslint` 8.73.0 (peer TS `< 6.1`) ·
`eslint` 10.15.0 · `prettier` 3.10.1 · `turbo` 2.11.12 · `husky` 9.1.7 · `lint-staged` 17.6.1 ·
`@fastify/helmet` 13.2.0 · `@fastify/cors` 11.4.3 · `@fastify/rate-limit` 11.2.2 · `@nestjs/testing` 12.5.1.
Hôte : Node v22.11.0, pnpm 9.0.0, Docker Compose v2.40.
