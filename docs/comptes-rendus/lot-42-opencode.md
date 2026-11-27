# Lot 42 : docs/deploiement.md, img-src sans data: (suite BF-17) (OpenCode)

Date : 27 novembre 2026. Branche `lot/42-doc-imgsrc`, depuis `develop` (aab3f9f).
Carte Trello « [DevOps] docs/deploiement.md : img-src sans data: (suite BF-17) » (#80). Documentation seule, `docs/` exclu de Prettier.
Aucun conteneur, aucun `pnpm install`, aucun test touché, aucun `pnpm check`, pas de `git push` ni de `gh` d'écriture.

## Fait

- `docs/deploiement.md` (section « CSP », l. 161) : `img-src 'self' data:` → `img-src 'self'`, aligné sur
  `scripts/deploy/csp-hashes.mjs` (`buildPolicy`, l. 81, émet `img-src 'self'` depuis BF-17 ; plus aucun `data:` dans la CSP du front).
  Rien d'autre modifié (pas de reformatage, pas d'autre section).
- Commit 1 : `docs(deploiement): img-src sans data: dans la section CSP`.
- Commit 2 : ce compte rendu.

## Non fait

- Aucune autre correction (hors périmètre du brief).

## Vérifications ciblées (D26)

- `grep -n "img-src" docs/deploiement.md` : une seule ligne (l. 161), `img-src 'self'`, plus aucun `data:`.
- `git diff --stat` : un seul fichier modifié (+ ce compte rendu, deuxième commit).
- `docs/` est exclu de Prettier : pas de `pnpm format:check`.

## Décisions

Aucune. Ligne corrigée telle que prescrite, description conforme à `buildPolicy`.

## Points ouverts

Aucun.
