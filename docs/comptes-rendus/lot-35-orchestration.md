# Lot 35 : panne du serveur (orchestration et rejeu des vérifications)

Date : 26 novembre 2026. Branche `lot/35-panne-api` (depuis `develop` 567527c). Carte Trello « [Bug] Réponse de
/api/* quand l'API est en erreur serveur ou arrêtée ». Isolation : projet `siteperso-v3-lot35`, PostgreSQL
6012/6013, Playwright 6010, site e2e 6011 ; pile d'essai VPS `siteperso-v3-lot35-vps` ; pile locale
`siteperso-v3-lot35-local` (ports 6014/6015, `docker/.env.local` créé pour l'essai puis retiré).

## Décisions de Julien (D48, `docs/05-front-organisation.md`)

Proposition soumise avant toute implémentation, les trois recommandations retenues :

- **Page** : la page 50x du lot 30 est refondue en place (mêmes adresses, même mécanisme), pas doublée.
- **Détection** : dans Caddy seulement (pile et hôte), pour 500, 502, 503, 504 ; aucune bascule côté front, qui
  n'appelle jamais l'API pendant la visite (lot 33).
- **`/api/*`** : problem+json minimal quand Caddy produit l'erreur, statut d'origine gardé, `no-store`,
  `Retry-After: 30` ; contrat OpenAPI inchangé.

## Tickets

| Ticket | Agent | Livré | Compte rendu |
|---|---|---|---|
| L35-1 | dev-devops | trois Caddyfile synchrones, `docker/host-errors.caddy` (bloc de l'hôte, source unique, importé par le frontal d'essai), `vps-stack.sh errors|stop|start`, tests `panne-api-caddy`, `panne-hote`, `panne-vps-stack`, `docs/deploiement.md` | `lot-35-devops.md` |
| L35-3 | lead-architecte | page « panne du serveur » (`error.vue`, `common.json` fr/en), tests `error-outage.spec.ts`, parcours `server-outage.e2e.ts` | `lot-35-lead.md` |
| L35-2 | correcteur | tests rendus obsolètes par D48 (D23, `Justification-test: L35-TESTS`) : `error-server.spec.ts`, `server-error.e2e.ts`, `wip-mode.e2e-spec.ts`, `local-stack.e2e-spec.ts` | `lot-35-correcteur.md` |

Correction après rejeu : `12a2f16` (dev-devops) : le `csp.caddy` factice de `panne-vps-stack` perdait les
apostrophes de `'self'` (citation shell dans le test) ; aucune assertion changée.

## Rejeu des vérifications (après le redémarrage de la machine, Podman libre)

Le blocage de Podman décrit dans `lot-35-devops.md` (« Non fait / non prouvé ») est levé : la pile d'essai bloquée a
été arrêtée (`down --volumes`) au redémarrage. Tout ce qui suit a été lancé sous `systemd-run --user --scope` avec
des bornes, une chose lourde à la fois.

| Vérification | Résultat |
|---|---|
| `vitest --project e2e panne-api-caddy panne-hote wip-mode prod-vps prod-static` | 52/52 |
| `vps-stack.sh up` (`restart: 'no'`) puis `panne-vps-stack` (`VPS_STACK_REQUIRED=1`) | 3/4 puis, après `12a2f16`, 4/4 : API arrêtée puis pile arrêtée, vues de la pile et de l'hôte |
| `vps-stack`, `vps-stack-guard` (`VPS_STACK_REQUIRED=1`) | 9/9 |
| `stack:up` puis `local-stack`, `local-stack-fr-redirect`, `local-stack-front` (`STACK_REQUIRED=1`) | 35/35 (dont le 502 problem+json) |
| `pnpm lint:shell` | code 0 |
| `generate:fixtures`, `generate:without-ai`, Playwright `server-outage server-error csp pages` (7 tailles, `--workers=2`) | 378/378 |
| `pnpm integrity develop` | OK |

Conteneurs arrêtés en fin de lot (`stack:down --volumes`, `vps-stack.sh down`, `pnpm db:down`) ; aucun conteneur ni
volume `lot35` restant.

## Points ouverts

- **Textes de la page à valider par Julien** (commités tels que proposés, `lot-35-lead.md`) : titre « Le serveur est
  en panne pour l'instant » / « The server is temporarily down », texte et phrase « Rien n'est perdu… » / « Nothing is
  lost… ».
- **Serveur réel** : reporter `docker/host-errors.caddy` dans le site du Caddy de l'hôte (`add-app.sh`) à la place
  de l'ancien bloc documenté, puis vérifier, pile arrêtée, `/api/*` en 502 problem+json et `/_nuxt/*` en 200.
- Hooks : `bash scripts/deploy/vps-stack.sh errors` lancé à la main par un agent est refusé (« écriture opaque qui
  mentionne un oracle »), comme au lot 32 ; les tests l'appellent sans souci.
- Hooks : une autorisation créée par `authorize.mjs` sans `CLAUDE_PROJECT_DIR` est écrite dans l'état du checkout
  principal, alors que les hooks d'une session de worktree lisent celui du worktree : la première autorisation du
  lot était invisible pour le correcteur (recréée avec `CLAUDE_PROJECT_DIR` posé). À corriger dans `authorize.mjs`
  ou à documenter.
- Après le redémarrage : `podman.socket` (service utilisateur) n'était pas démarré (démarré pour la session, non
  activé) et `pnpm` n'était pas dans le PATH des shells des agents.
- Collision de numéro : la session F11 a aussi pris D48 ; ce lot garde D48, F11 renumérote.
