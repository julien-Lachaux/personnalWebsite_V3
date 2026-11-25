# Lot 32 : mode travaux et pages d'erreur dans Caddy (dev-devops)

Date : 25 novembre 2026. Branche `lot/32-mode-travaux` (depuis `develop` 69eee71). Carte Trello 52.
Isolation : projet `siteperso-v3-lot32`, PostgreSQL 5952/5953, Playwright 5950, site e2e 5951.

## Commits

1. `feat(deploy)` : `docker/wip.caddy`, `docker/caddy-start.sh`, `docker/Caddyfile` et `Caddyfile.vps` (corps toujours
   identiques), `docker/compose.prod.yml` (variables `WIP_*`, point d'entrée, deux fichiers montés).
2. `test(deploy)` : `apps/api/test/wip-mode.e2e-spec.ts` (nouveau).
3. `docs` : `docs/deploiement.md` (mode travaux, pages d'erreur, bloc de l'hôte), modèles d'environnement.
4. Ce compte rendu.

## Fait

- **Mode travaux** (`WIP_MODE=on|off`, `WIP_KEY`) : redirection 302 `no-store` de toute adresse hors `/api/*` vers
  `/travaux` (ou `/en/work-in-progress` pour `/en`, `/en/*`) ; pages travaux en 503 + `Retry-After` + `X-Robots-Tag:
  noindex` + CSP du front + `no-cache` ; passent `/_nuxt/*`, `/_i18n/*`, `/fonts/*`, `/robots.txt` et les deux
  `_payload.json`. Clé `/?acces=<clé>` : cookie `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`, redirection sans
  le paramètre (les autres paramètres sont gardés), site visible avec le cookie. Clé ou cookie faux : comportement actif,
  aucun cookie, aucun indice.
- **Cookie** : valeur = SHA-256 de `wip:<clé>` (calculée par `caddy-start.sh`, lue par `{file./tmp/wip.token}`), jamais
  la clé ; changer la clé invalide les cookies.
- **Journal** : le paramètre `acces` est retiré de l'URI journalisée (`format filter`), vérifié dans le test et sur la
  vraie pile ; `Cookie` et `Set-Cookie` sont déjà masqués par Caddy.
- **Refus de démarrer** : `caddy-start.sh` arrête le conteneur (message clair) si `WIP_MODE` n'est ni `on` ni `off`, si
  `WIP_MODE=on` avec une clé de moins de 32 caractères ou hors `A-Za-z0-9._~-`, ou si `WIP_API` est invalide.
- **Pages d'erreur** : `handle_errors` sert `50x.html` / `en/50x.html` (500, 502, 503, 504 hors `/api/*`) par réécriture,
  statut de l'erreur, CSP, `no-cache` ; 404 inchangées.
- **Caddy de l'hôte** : bloc exact, copie à chaque déploiement et filtre de journal dans `docs/deploiement.md`.
- Vérifié en vrai : conteneur Caddy seul sur le vrai `Caddyfile.vps` (19 scénarios du test) et pile VPS d'essai complète
  (`vps-stack.sh`, `WIP_MODE=on`) : API 200 (ouverte), `/` et `/en/x` redirigés, clé : 302 sans paramètre, clé absente du
  journal (0 occurrence). Pile arrêtée avec volumes.

## Non fait

- Pas de page travaux servie sur la vraie pile (le site n'y est pas généré) : la page 503 est prouvée sur un site factice.
- Pas de nouvelle étape de CI (le test tourne dans le job e2e de l'API, il lance un conteneur Caddy ; sans moteur de
  conteneurs il se signale et échoue seulement si `CI` est posée).

## Décisions (Julien, 25 nov.)

- API ouverte en mode travaux, page en 503 : validés. Réglables : `WIP_API=closed` (503 problem+json sans cookie),
  `WIP_STATUS`, `WIP_RETRY_AFTER`.
- Erreurs serveur de `/api/*` : hors lot (ticket séparé), comportement inchangé. Constaté, API arrêtée : `502 Bad Gateway`,
  `Content-Type: text/plain; charset=utf-8`, corps `502 Bad Gateway` (test `wip-mode`, premier scénario).

## Choix à valider

- Les variables sont lues par Caddy à la création du conteneur : activer, couper ou changer la clé demande
  `compose up -d caddy` (quelques secondes, site non régénéré), et non un `caddy reload` (qui ne relit pas l'environnement
  du conteneur). Procédure dans `docs/deploiement.md`.
- `/sitemap.xml`, `/cv/*` et toute adresse inconnue sont aussi redirigés sans cookie (seules les ressources de la page et
  `robots.txt` passent).
- Le cookie valide laisse aussi voir `/travaux` en 200 (c'est le site normal).

## Points ouverts

- **Podman verrouillé** : `podman compose -p siteperso-v3-lot32-vps … down --volumes` (arrêt de la pile d'essai) ne rend pas la main depuis plus de 15 min, et les `podman ps` suivants attendent le verrou. Je n'ai rien interrompu (consigne). À la reprise : vérifier `podman ps -a | grep lot32`, volumes `lot32`, `rm -rf /tmp/siteperso-vps-run.lot32 docker/.env.vps-test` (gitignoré), et `pnpm db:down` (le postgres de test du lot tourne encore).

- Le Caddy de l'hôte journalise l'URI avec la clé : appliquer le filtre du bloc documenté (`add-app.sh`).
- À relever sur le serveur : `caddy-start.sh` sous Podman 5.4 (entrypoint, `sha256sum` de busybox, `/tmp` en tmpfs), puis
  `compose up -d caddy` avec `docker-compose` 2.26 ; la copie des pages 50x vers le dossier de l'hôte.
- Hooks : une fois mon test ajouté, ils ont refusé `bash scripts/deploy/vps-stack.sh` (« écriture opaque qui mentionne un
  oracle : vps-stack.e2e-spec.ts », cité dans les commentaires du script) ; j'ai arrêté la pile par `podman compose … down`
  directement. L'orchestrateur voudra peut-être revoir ce refus.
- Le job CI qui lancerait le test dans le job e2e : à vérifier sur la pull request (image Caddy tirée du registre).

## Vérifications

`vitest run --project e2e wip-mode prod-vps prod-compose` : 38/38 ; `pnpm --filter @siteperso/api lint` et `typecheck`
verts ; `pnpm format` ; hooks pre-commit (lint, typecheck, test) verts à chaque commit. `pnpm format:check` et `pnpm integrity develop` : OK.
`pnpm lint:shell` : NON JOUÉ (podman verrouillé, voir points ouverts) ; `caddy-start.sh` est le seul script ajouté (`sh`, `set -eu`).
