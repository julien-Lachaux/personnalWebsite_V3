# Lot 39 : docs/deploiement.md, en-têtes de la page statique périmés (OpenCode)

Branche `lot/39-doc-deploiement` (depuis `develop` fe94d39). Tâche atomique, documentation seule.
Carte Trello « [DevOps] docs/deploiement.md : en-têtes de la page statique périmés ». Rien n'a été
poussé ; aucun conteneur lancé, aucun `pnpm install`, aucun test modifié.

## Fait

Réécriture du seul passage périmé dans `docs/deploiement.md`, section « Ce que Caddy filtre et
annonce » (fin du point « En-têtes de sécurité sous `/api/*` »). Le passage disait
« Pour la page statique : `default-src 'self'` et `X-Frame-Options: SAMEORIGIN`. À adapter quand le
front sera servi. » Il décrit maintenant le `docker/Caddyfile` actuel :

- `X-Frame-Options: DENY` (et non `SAMEORIGIN`), y compris sur les pages d'erreur du front ;
- CSP stricte sans `'unsafe-inline'`, `default-src 'self'`, `frame-ancestors 'none'`, avec les
  empreintes des scripts et styles en ligne, générée au déploiement par
  `scripts/deploy/csp-hashes.mjs`, écrite dans `csp.caddy`, importée par `docker/Caddyfile`
  (`import /srv/web/current/csp.*`), aussi sur les pages d'erreur ;
- posés par Caddy, pas par l'API : helmet (`X-Frame-Options: DENY`, `Content-Security-Policy:
  default-src 'none';frame-ancestors 'none'`) ne couvre que `/api/*`, où Caddy double avec le
  préfixe `?` ; la page statique n'est pas servie par l'API.

Rien d'autre n'a été touché : ni les paragraphes voisins, ni les autres sections. `docs/` est
exclu de Prettier.

Commit 1 : `docs(deploiement): corriger les en-têtes de sécurité de la page statique`.
Commit 2 : ce compte rendu.

## Non fait

- Aucun `git push`, aucune commande `gh` d'écriture, aucune création de worktree ou de branche,
  aucune fusion ; rien n'est poussé ni modifié ailleurs que `docs/deploiement.md` et ce compte
  rendu.
- Aucun test modifié, aucun conteneur, aucun `pnpm install`, pas de `pnpm check`, pas de
  `pnpm format:check` (inutile : `docs/` exclu de Prettier).
- `docs/comptes-rendus/lot-24-service-front.md` : absent du dépôt (« si présent » au brief) ; les
  comptes rendus lot 24 présents sont `docs/comptes-rendus/lot-24-devops.md` et
  `docs/comptes-rendus/lot-24-recette.md`, seul `lot-24-devops.md` a été relu pour l'état réel.

## Décisions

- Formulations : français, chemins entre accents graves, « CSP » comme le reste du document, `…`
  déjà utilisé dans le fichier ; style du bullet voisin conservé.
- `X-Frame-Options: DENY` (forme du document) plutôt que la syntaxe Caddy `X-Frame-Options "DENY"`.
- `csp.caddy` nommé explicitement (nom réel produit), plus le motif `csp.*` de l'import, comme le
  `Caddyfile` ; `docker/Caddyfile` chemin complet vérifié.
- Politique complète non recopiée : déjà détaillée dans la section « Caddy et la CSP du front » du
  même document ; le passage reste court et renvoie aux mécanismes.
- Pas de correction de `img-src 'self' data:` en « Caddy et la CSP du front » (l. ~161), qui
  diverge de `buildPolicy` (`img-src 'self'` dans `csp-hashes.mjs`) : hors du passage à réécrire,
  signalé en point ouvert.
- Trailer `Co-Authored-By: OpenCode <noreply@opencode.ai>` du brief (et non celui de CLAUDE.md).

## Points ouverts

- Écart noté, non corrigé (hors périmètre du lot) : `docs/deploiement.md` l. ~161 dit
  `img-src 'self' data:` alors que `scripts/deploy/csp-hashes.mjs` `buildPolicy` émet `img-src
  'self'`. Le passage réécrit ici décrit bien `img-src 'self'`. À trancher par l'orchestrateur
  sur un autre lot si on veut aligner la section « Caddy et la CSP du front ».
- Écart noté, non corrigé : la carte Trello mentionne `X-Frame-Options DENY` « cf. l. 159 »
  et un `pnpm format:check` vert ; l'état réel est vérifié sur `docker/Caddyfile`, et `docs/` est
  exclu de Prettier.
- `docker/Caddyfile.vps` et `docker/Caddyfile.vps-static` (variantes production, lots 29/33)
  portent les mêmes `X-Frame-Options DENY` + `import /srv/web/current/csp.*` ; vérifiés en lecture,
  rien à changer. Le passage décrit `docker/Caddyfile`, comme demandé.

## Commandes de vérification (D26, pas de `pnpm check`)

- `git status --short --branch` → propre sur `lot/39-doc-deploiement`.
- Lecture de `CLAUDE.md`, carte Trello (`trelloSearch` `search_cards` sur « [DevOps]
  docs/deploiement.md : en-têtes de la page statique périmés » → carte
  `6b08354b12e558c210a7f6d2`, liste « En cours », board « Personal Website V3 »).
- Lecture complète de `docker/Caddyfile` (172 l.) → `header X-Frame-Options "DENY"` (front, l. 104),
  `handle_errors` `header X-Frame-Options "DENY"` (l. 131) + `import /srv/web/current/csp.*` pour
  les pages d'erreur du front `@fronterr` (l. 133-135), `import /srv/web/current/csp.*` front
  (l. 103), `handle /api/*` `?X-Frame-Options "DENY"` + `?Content-Security-Policy
  "default-src 'none';frame-ancestors 'none'"` + `-Via` (l. 54-58), `-Server`, HSTS, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`.
- Lecture complète de `scripts/deploy/csp-hashes.mjs` → sortie `header Content-Security-Policy
  "…"`, `buildPolicy` : `default-src 'self'`, `script-src 'self'` + empreintes `'sha256-…'`,
  `style-src 'self'` + empreintes, `img-src 'self'`, `font-src 'self'`, `connect-src 'self'`,
  `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`, sans
  `'unsafe-inline'`.
- `grep -rn csp-hashes scripts/ docker/ docs/deploiement.md` → appel dans
  `scripts/deploy/web-generate.sh` et `scripts/deploy/build-site-archive.sh`, sortie `csp.caddy`,
  `CSP_SCRIPT`, copie dans l'image `docker/web.Dockerfile`.
- `grep -n "X-Frame-Options\|Content-Security-Policy\|csp\.\*" docker/Caddyfile.vps
  docker/Caddyfile.vps-static` → mêmes valeurs `DENY`, même import `csp.*`, `default-src
  'none';frame-ancestors 'none'` pour `/api/*`.
- `grep -n CSP_DIRECTIVES apps/api/src/infrastructure/http/create-app.ts` +
  `grep -n "helmet\|frameguard\|contentSecurityPolicy" apps/api/src/infrastructure/http/create-app.ts`
  → `@fastify/helmet` `frameguard: { action: 'deny' }` + `contentSecurityPolicy { useDefaults:
  false, directives: CSP_DIRECTIVES }`, `CSP_DIRECTIVES = { defaultSrc: ["'none'"], frameAncestors:
  ["'none'"] }` → CSP API `default-src 'none';frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  helmet ne couvre que `/api/*`.
- `git diff` après édition → un seul passage modifié.
- `git show --stat HEAD` → `docs/deploiement.md | 7 +++++--, 1 file changed, 5 insertions(+),
  2 deletions(-)`.
- `git status --short` → rien d'autre.
- `sed -n '385,392p' … | cat -A` → LF, pas d'espace en fin de ligne.
