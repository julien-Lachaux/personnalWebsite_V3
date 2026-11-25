# Lot 29 : production sous Podman rootless, Caddy en deux niveaux (dev-devops, 25 nov. 2026)

## Fait
- L29-01 : `DEPLOY_COMPOSE`, `DEPLOY_INSPECT`, `DEPLOY_VARIANT`, `DEPLOY_WEB_BUILD` (`scripts/deploy/common.sh`, `site.sh`) ; défauts inchangés.
- L29-02 : tous les `image:`/`FROM` portaient déjà un nom complet avec digest ; la variante VPS nomme `localhost/siteperso-*:prod` ; test dédié. Le Caddy épinglé (digest existant) est déjà la 2.11.9.
- L29-03 : healthcheck de l'API déclaré dans `docker/compose.prod.yml`.
- L29-04 : `docker/compose.vps.yml`, `docker/Caddyfile.vps` (même site que `Caddyfile`, vérifié par test). Config effective : aucun `ports`, aucun `cap_add`, réseau `app` seul pour Caddy.
- L29-05 : `scripts/deploy/vps-stack.sh`, `docker/compose.vps-frontal.yml`, `docker/Caddyfile.frontal-test`, `apps/api/test/vps-stack.e2e-spec.ts`. Prouvé sous Podman 6.2 rootless : client A (10.89.3.2) limité à 429 après 5 requêtes, client B (10.89.3.3) 200 même avec un `X-Forwarded-For` forgé ; le journal de la pile porte les deux adresses. RS-4 mise à jour dans `docs/deploiement.md`.
- L29-06 : essai réel : sans `oom_score_adj`, `exec` échoue (126, unhealthy) ; avec, tout passe (postgres healthy, `exec` OK). Valeurs : postgres 300, api/caddy/migrate 500, web-build 900.
- L29-07 : `DEPLOY_DIR` chmod seulement à la création ; `.env.prod.example` documente les variables.
- L29-08 : section « Production sous Podman sans privilèges » de `docs/deploiement.md`.

## Tests ajoutés (aucun existant modifié)
`prod-vps.e2e-spec.ts`, `deploy-compose-command.e2e-spec.ts`, `vps-stack.e2e-spec.ts`.

## Vérifications
- lint, typecheck, `format:check`, `lint:shell`, `bash -n` : verts. Pre-commit vert aux deux commits.
- e2e `prod-vps`, `vps-stack` (pile réelle), `deploy-compose-command`, `prod-compose` : verts.
- `deploy-scripts.e2e-spec.ts` échoue sur ce poste (pas de binaire `docker` : « docker est introuvable », message identique avant ce lot) ; vert avec `DEPLOY_COMPOSE=true DEPLOY_INSPECT=true` (8/8) ; vert en CI qui a docker.
- L'échec du pre-commit `@siteperso/web#test` du premier essai n'a pas reproduit après correction du `.env` racine (124 fichiers, 1138 tests verts).
- Piles d'essai arrêtées (`down -v`).

## Décisions
- Caddyfile.vps dupliqué (et non paramétré) pour ne pas toucher `docker/Caddyfile`, lu par des tests existants ; synchro garantie par test.
- Build du front par `podman build` sur le VPS (docker-compose sans BuildKit ignore l'exclusion propre au front).
- `local-stack.sh` inchangé (son moteur vient déjà de `container-engine.sh`).

## Points ouverts
- À lancer par Julien sur le VPS sous `app-site-perso` : exporter les variables (doc), `bash scripts/deploy/first-install.sh`, puis `update.sh` ; vérifier `https://<domaine>/api/v1/health`, `curl -4`/`curl -6`, le journal de l'hôte, `exec` sous Podman 5.4.2 et la syntaxe `!reset`/`!override` sous Compose 2.26 (non testée ici, Compose 5.8 local).
- Branchement CI de `vps-stack` (`ci.yml`, autorisation requise) : `vps-stack.sh up`, `vitest run --project e2e vps-stack` avec `VPS_STACK_REQUIRED=1`, `down`.
- Sous Docker (CI), la pile d'essai n'a pas été jouée ici.
