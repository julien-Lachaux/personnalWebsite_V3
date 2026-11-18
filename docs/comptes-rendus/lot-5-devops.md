# Lot 5 : DevOps, compte rendu

Branche `lot/5-devops`, 4 commits atomiques au-dessus de `v3/backend` (un par ticket L5-01 à L5-04),
plus ce compte rendu. Le lot 1 (runner de migrations) n'est pas encore fusionné : L5-05 (vérification de
bout en bout) est donc partiellement faite, voir « Non fait ».

## Fait

- **L5-01** : `docker/api.Dockerfile` (deps, build, prune par `pnpm deploy --prod`, runtime
  `node:26.13.1-alpine`, utilisateur `node`, `HEALTHCHECK` sur `/api/v1/health`, `db/` copié),
  `.dockerignore` strict, service `api` (profil `api`) et `name: siteperso-v3` dans `docker-compose.yml`.
  Vérifié : `docker build` passe ; `id -u` = 1000 ; ni `src`, ni `.env`, ni `pnpm` dans l'image ; taille
  215 Mo (< 300 Mo) ; conteneur démarré contre un Postgres Docker avec `TRUST_PROXY=true` :
  `/api/v1/health` = 200 `{"status":"ok","checks":{"database":"up"}}`, état Docker `healthy` ;
  `docker compose --profile api config` valide.
- **L5-02** : `docker/compose.prod.yml` (`name: siteperso-v3-prod`), `docker/Caddyfile`,
  `docker/.env.prod.example`, `docker/placeholder/index.html`. Vérifié : `docker compose config` passe avec
  l'exemple ; aucun `ports:` sous `postgres` ; seul `caddy` publie (80, 443, 443/udp) ; `caddy validate`
  passe ; Caddy (`SITE_DOMAIN=localhost`) devant l'API : `https://localhost:8443/api/v1/health` = 200 et `/`
  sert le placeholder avec les en-têtes de sécurité.
- **L5-03** : `scripts/deploy/{first-install,update,backup}.sh` + `common.sh`, `docs/deploiement.md`.
  Vérifié : `bash -n` et shellcheck (image `koalaman/shellcheck:stable`) passent ; exécution à blanc
  (`DRY_RUN=1`, `DEPLOY_DIR` temporaire) : 1re exécution crée `.env.prod` (droits 600, mot de passe généré)
  et sort avec le code 10, 2e exécution (valeurs du modèle) code 10, 3e (valeurs de test) code 0, 4e
  identique (idempotent). `pg_dump | gzip` validé sur un Postgres de test.
- **L5-04** : `.github/workflows/ci.yml` (jobs `qualite`, `e2e`, `docker`). Vérifié : `actionlint` passe ;
  une seule portée `permissions: contents: read` ; aucun secret ni push d'image. Commandes locales
  équivalentes, toutes vertes : `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test
&& pnpm test:e2e` (e2e contre le postgres de test), et `docker build -f docker/api.Dockerfile .`.

## Non fait

- **L5-05, partie dépendante du lot 1** : le service `migrate` appelle `node dist/cli/migrate.js && node
  dist/cli/seed.js` (noms prévus à L1-01/L1-02) qui n'existent pas encore. Non vérifiés : le démarrage
  complet `compose.prod.yml up -d --build`, `curl -sk https://localhost/api/v1/health` via le compose,
  `/api/v1/cv` (après lot 3), `first-install.sh` sans `DRY_RUN` (attente du healthcheck), `down -v`. À
  rejouer après fusion du lot 1 sur `v3/backend`. `docker ps -a | grep siteperso-v3-prod` est vide (rien
  n'a été lancé avec ce projet).
- Aucun `pnpm db:down` : les conteneurs `siteperso-v3-postgres` et `-postgres-test` appartiennent à une
  autre session (noms fixes partagés entre worktrees) ; ils n'ont pas été touchés. Mes essais ont utilisé
  des conteneurs et un réseau `lot5-*` éphémères, tous supprimés.

## Décisions prises

- Node 26 n'embarque plus `corepack` : pnpm est installé par `npm install --global pnpm@9.0.0` (version du
  champ `packageManager`) dans les étapes de build, absent du runtime. `.npmrc` n'est pas copié dans
  l'image : c'est ce qui neutralise `use-node-version` (`--config.use-node-version=` vide faisait échouer
  `engine-strict`). `--ignore-scripts` évite husky.
- `.env.prod` vit dans `DEPLOY_DIR` (hors dépôt, droits 600), passé par `--env-file` ; code de sortie 10 =
  « à remplir ». `DRY_RUN=1` rend les étapes d'état testables sans serveur.
- Le service `migrate` réutilise l'image `siteperso-api:prod` construite par `api` (`pull_policy: never`).
- Caddy : `/api/*` proxifié, reste servi depuis `docker/placeholder` ; en-têtes complémentaires posés par
  Caddy (HSTS, nosniff, referrer, frame, permissions) ; `web` laissé en commentaire.
- CI : Node 26.13.1 via `actions/setup-node@v4` ; e2e sur le port 5433 pour coller au défaut de
  `vitest.e2e.config.ts`.

## Points ouverts

- `.gitignore` (`.env.*` sauf `.env.example`) ignore `docker/.env.prod.example` : ajouté avec `git add -f`.
  Une ligne `!.env.prod.example` dans `.gitignore` (hors périmètre) est à appliquer par l'orchestrateur.
- Rejouer L5-02/L5-03/L5-05 après fusion du lot 1 (runner) puis du lot 3 (`/api/v1/cv`).
- Cette CI n'a pas pu être exécutée sur GitHub (pas de push) ; seul actionlint et l'équivalent local l'ont
  validée.
