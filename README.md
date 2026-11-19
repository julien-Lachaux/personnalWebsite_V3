# Site perso V3 : back-end

Monorepo pnpm + Turborepo : API NestJS/Fastify en architecture hexagonale (`apps/api`),
contrats Zod + OpenAPI 3.2.0 (`packages/contracts`), schéma et contenu en SQL (`db/`).
Décisions et modèle de données : `docs/`. Conventions pour les agents : `CLAUDE.md`.
Agents spécialisés et garde-fous contre le contournement des tests : `.claude/agents/`,
`.claude/hooks/` et `scripts/ci/check-tests-integrity.sh` (lancés par `pnpm check` et la CI).

## Lancer en 4 commandes

Prérequis sur l'hôte : Docker (avec `docker compose`) et pnpm 10 (>= 10.34.5 : les versions 9.x sont visées par des avis de sécurité sans correctif). Node 26 (dernière ligne
stable) est téléchargé par pnpm (`.npmrc`, `use-node-version`), rien d'autre à installer.

```sh
pnpm install                       # 1. dépendances + hook pre-commit
cp .env.example apps/api/.env      # 2. configuration locale de l'API (jamais commitée)
pnpm db:up                         # 3. PostgreSQL 16 de dev (docker compose)
pnpm db:migrate && pnpm db:seed    # 3 bis. schéma et contenu du CV (SQL de db/, rejouables)
pnpm dev                           # 4. compile les contrats puis API en watch : http://localhost:3000/api/v1
```

`pnpm db:reset` recrée le schéma de la base de dev puis rejoue migrations et seeds (refusé avec
`NODE_ENV=production`).

Vérifier :

```sh
curl -s http://localhost:3000/api/v1/health      # 200 {"status":"ok","checks":{"database":"up"}}
curl -s http://localhost:3000/api/v1/docs.json   # 200 contrat OpenAPI 3.2.0 ("openapi":"3.2.0")
curl -s http://localhost:3000/api/v1/profile     # 501 application/problem+json jusqu'au lot 3
curl -s http://localhost:3000/api/v1/inconnue    # 404 application/problem+json
curl -si http://localhost:3000/api/v1/health | grep -i x-ratelimit   # quota par IP (défaut 100/min), 429 au-delà
```

`pnpm build` compile les contrats puis l'API dans `dist/` ; `pnpm start` lance la version
compilée.

Pile locale complète identique à la production (Caddy, API, PostgreSQL, même compose et même image) pour
reproduire un problème de prod : `pnpm stack:up` puis `curl -k https://localhost:8443/api/v1/health` (voir
`docs/deploiement.md`, « Pile locale complète »).

## Qualité

```sh
pnpm check           # démarre le Postgres de test puis lint, typecheck, tests unitaires, e2e et couverture
pnpm test:coverage   # unitaires + e2e en une passe : couverture fusionnée, échoue sous 100 %
pnpm db:down         # arrête les conteneurs
```

Le hook pre-commit (husky) lance lint, typecheck et tests unitaires ; les e2e et la couverture
tournent dans `pnpm check` et en CI. La couverture (lignes, branches, fonctions, instructions) de
`apps/api/src` et `packages/contracts/src` doit être de 100 %, mesurée en une seule passe
unitaires + e2e (`@vitest/coverage-v8`, rapports `text`, `lcov` et `json-summary` dans
`coverage/`, gitignoré) ; aucun fichier de production n'est exclu et aucun commentaire d'ignore
n'est admis. `pnpm format` applique Prettier (les documents de `docs/` sont exclus).

## Arborescence

```
apps/api/             API NestJS sur Fastify : src/domain, src/application, src/infrastructure
packages/contracts/   schémas Zod partagés et génération OpenAPI (dist/openapi.json)
db/migrations/        SQL manuel NNNN_description.sql (runner : apps/api/src/infrastructure/db)
db/seeds/             contenu SQL idempotent
docker-compose.yml    postgres (dev, :5432) et postgres-test (:5433, tmpfs)
docs/                 état des lieux V2, modèle de données, stack, organisation
docs/comptes-rendus/  compte rendu de chaque agent par lot
```
