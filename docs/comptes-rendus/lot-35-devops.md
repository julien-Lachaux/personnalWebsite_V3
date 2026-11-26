# Lot 35, dev-devops (L35-1) : panne de l'API et de la pile (D48)

Date : 26 nov. 2026. Branche `lot/35-panne-api`.

## Fait

- **Caddy de la pile** (`docker/Caddyfile`, `Caddyfile.vps`, `Caddyfile.vps-static`, synchrones) : dans
  `handle_errors`, une branche `@apierr` (`/api/*` et statut 500, 502, 503, 504) répond `application/problem+json`
  `{"type":"about:blank","title":"<libellé HTTP>","status":<statut>,"detail":"Le service est momentanément
  indisponible. Réessayez dans quelques instants."}` au statut d'origine, avec `Cache-Control: no-store`,
  `Retry-After: 30`, `Content-Security-Policy "default-src 'none';frame-ancestors 'none'"`, `X-Frame-Options: DENY`
  (déjà posé par `handle_errors`), `X-Content-Type-Options: nosniff`, sans `Server`. Une erreur de l'API elle-même
  traverse `reverse_proxy` sans passer par `handle_errors` (prouvé, voir tests).
- **Caddy de l'hôte** : source unique `docker/host-errors.caddy` (bloc `handle_errors` à reporter sur l'hôte) : mêmes
  règles ; 500 ajouté aux statuts de la page 50x ; `/_nuxt/*` et `/fonts/*` servis en **200** (`status 200` : sans
  lui `file_server` gardait le 502 de l'erreur, constaté par le test). Importé par `docker/Caddyfile.frontal-test`
  (frontal d'essai), monté par `compose.vps-frontal.yml` avec un volume `frontal_errors` (copie des pages de secours).
- `scripts/deploy/vps-stack.sh` : nouvelles commandes `errors` (copie des pages de secours vers le frontal, mêmes
  commandes que la doc), `stop` et `start`.
- `docs/deploiement.md` : pages d'erreur serveur, bloc de l'hôte (renvoi au fichier source), copie, écarts de parité
  (le 502 n'est plus un écart ; 400 et 413 restent), tableau de parcours manuel (ligne 8).
- Tests nouveaux : `panne-api-caddy.e2e-spec.ts` (Caddyfile.vps réel dans un Caddy seul : 502, 500/503/504 provoqués,
  en-têtes, corps exact, POST, 500 de l'amont transmis inchangé, pages 50x fr/en), `panne-hote.e2e-spec.ts`
  (host-errors.caddy réel : problem+json, 504, 500 de l'amont, pages 50x avec CSP copiée, ressources en 200) et
  `panne-vps-stack.e2e-spec.ts` (pile d'essai `vps-stack.sh` : API arrêtée puis pile arrêtée, via le frontal).
- Commits : `bd05a5b`, `a012a19`, `2bfc615`, `6a0978f` (+ celui de ce compte rendu).

## Vérifications (résultats)

- `pnpm exec vitest run --project e2e panne-api-caddy` : 8 tests verts. `... panne-hote` : 5 tests verts (après
  correction `status 200` du bloc des ressources).
- `pnpm format:check` vert ; hook pre-commit (lint, typecheck, tests unitaires) vert sur chaque commit.
- Essai manuel sur la pile d'essai VPS (podman, API arrêtée) : `/api/v1/profile` via le frontal : 502
  `application/problem+json`, corps exact, `Cache-Control: no-store`, `Retry-After: 30`, CSP et `X-Frame-Options`.

## Non fait / non prouvé

- **`panne-vps-stack.e2e-spec.ts` n'a pas pu être exécuté jusqu'au bout** : Podman s'est bloqué pendant le test, sur
  `bash scripts/deploy/vps-stack.sh stop api` (`podman compose stop api`, processus 3365128/3365138/3365151 en
  attente depuis plus de 25 minutes) ; même un `podman ps` simple n'a pas répondu (processus 3386721). Conformément
  à la consigne, rien n'a été tué ni relancé. Conséquences : le test de pile (API arrêtée puis pile arrêtée, et les
  cas hôte sur le vrai frontal) est **non prouvé**, `pnpm lint:shell` (conteneur) et les essais `prod-vps`,
  `prod-static`, `wip-mode`, `local-stack` (compose) n'ont pas été lancés, et la pile d'essai
  `siteperso-v3-lot35-vps` (ainsi que `siteperso-v3-lot35-postgres-test-1`) n'est **pas arrêtée ni nettoyée**
  (`down --volumes`, dossier `/tmp/siteperso-vps-run.*`, `docker/.env.vps-test` à retirer) ; `pnpm db:down` non fait.
  Le comportement du frontal a seulement été constaté à la main avant le blocage (API arrêtée : 502 problem+json).
- Les hooks ont refusé `bash scripts/deploy/vps-stack.sh errors` lancé par l'agent (« écriture opaque qui mentionne un
  oracle ») : la sous-commande `errors` n'a donc été jouée que par les mêmes commandes écrites en clair (copie
  réussie dans le frontal) ; le test la lance par `spawnSync`.
- Contrat OpenAPI inchangé (aucun fichier touché).

## Décisions

- Périmètre `/api/*` limité à 500, 502, 503, 504 (D48) : 413 et 400 produits par Caddy restent en texte brut
  (`local-stack.e2e-spec.ts:184` et `:199` inchangés).
- Le site publié de la pile d'essai est factice (pages en une ligne, volume `<projet>_web_site`) : une vraie
  génération Nuxt demanderait migration et seed ; la page 50x réelle sera refondue par un autre ticket.
- `panne-vps-stack` arrête l'API puis Caddy et les relance en fin de fichier : ne pas le jouer en même temps que
  `vps-stack.e2e-spec.ts` (partage la pile). Il est ignoré (test unique) sans pile, comme `vps-stack`.

## Tests existants devenus obsolètes (à mettre à jour par le correcteur, `Justification-test: L35-TESTS`)

1. `apps/api/test/wip-mode.e2e-spec.ts:201`, « laisse /api/* répondre comme avant : 502 en texte brut quand l’API
   est arrêtée, jamais la page 50x » : lignes 205 et 206 : `content-type` doit être `application/problem+json`
   (`toBe`, plus `toContain('text/plain')`) ; `body` doit être
   `{"type":"about:blank","title":"Bad Gateway","status":502,"detail":"Le service est momentanément indisponible. Réessayez dans quelques instants."}`
   (au lieu de `'502 Bad Gateway'`).
2. `apps/api/test/local-stack.e2e-spec.ts:278`, « API arrêtée : 502 text/plain produit par Caddy (écart connu), sans
   Server » : ligne 284 : `content-type` doit contenir `application/problem+json` (au lieu de `text/plain`) ;
   statut 502 et absence de `Server` inchangés. Non rejoué ici (pile locale complète et podman bloqué) : sortie
   attendue de l'échec actuel, `expected 'application/problem+json' to contain 'text/plain'`.

Aucun autre test existant ne lit le corps ou le type d'une erreur de Caddy sous `/api/*` (recherche de `text/plain`,
`502`, `Bad Gateway` dans `apps/api/test`) ; `wip-mode:271` et `:343` ne lisent que le statut 502.

## Points ouverts

- Rejouer `panne-vps-stack` une fois Podman libéré (`bash scripts/deploy/vps-stack.sh up` avec
  `VPS_STACK_EXTRA_FILE` en `restart: 'no'`), puis `down` ; rejouer les tests de pile existants.
- Sur le serveur réel : reporter `docker/host-errors.caddy` dans le site de l'hôte (`add-app.sh`) à la place de
  l'ancien bloc, vérifier que `/api/*` sans pile répond 502 problem+json, que `/_nuxt/*` est servi en 200 et que
  la copie de `/srv/site-perso-errors` est à jour.
- Tracer côté front (autre ticket) que `/api/*` en 5xx est du problem+json (`Retry-After: 30`).
