# Recette du lot F9a (chef de projet, 22 nov. 2026)

Branche `lot/F9a-csp`, tête 334813a, PR #12 vers develop.

## Preuves

- CI `pull_request` run 45026826834 sur 334813a : `completed success`, 19 jobs verts, dont les 7 parcours
  Playwright (mobile-390 à ultra-3440). `csp.e2e.ts` lu en vert dans le journal du job grand-1440 (6 pages
  `/`, `/en`, `/accessibilite`, `/en/accessibility`, `/route-inconnue`, `/en/route-inconnue`) ; verdict
  global des jobs = succès, donc navigation et témoin verts aux 7 tailles.
- Revue automatisée (commentaire PR #12) : `VERDICT: OK`, trois constats non bloquants (comptes rendus du
  lead périmés après la fusion ; sortie de `pnpm integrity` non consignée par le correcteur ; alignement
  avec `csp-hashes.mjs` à revérifier à la fusion du lot 24).
- `pnpm integrity develop` : « Intégrité des tests : OK ».
- Périmètre `git diff develop...HEAD` : CLAUDE.md, `apps/web/app/data/fetch-cv.ts`,
  `apps/web/test/csp.e2e.ts`, 2 comptes rendus. Rien dans `apps/api`, `db`, `packages/contracts`,
  `docker/`, `scripts/deploy/`.

## Fond

1. Zod hors du navigateur : `generate:fixtures` (exit 0, 15 routes), puis `.output/public/_nuxt/*.js`.
   Seul le chunk `k2bm6MiX.js` contient `new Function` / Zod. Les pages ne le chargent qu'en
   `<link rel="prefetch">` (non exécuté) ; aucun des 5 chunks `modulepreload` ni le script d'entrée
   ne l'importe statiquement ; son unique référence est `import(\`./k2bm6MiX.js\`)` dans `D94PbemQ.js`
   (le gestionnaire de `useAsyncData`, non exécuté côté client, la charge utile fournit la donnée).
   Conforme. Réserve : le prefetch télécharge le chunk au repos du navigateur, sans l'évaluer.
2. `csp.e2e.ts` : politique recalculée équivalente, directive par directive, à `csp-hashes.mjs` de
   `lot/24-service-front` (mêmes fonctions `cspHash`, `inlineHashes`, `buildPolicy`, `default-src 'self'`,
   `script-src`/`style-src` par empreintes seules, aucun `unsafe-*`). Échoue sur toute violation
   (`securitypolicyviolation`), erreur console et `pageerror` ; seule exception, le message navigateur
   « Failed to load resource … 404 » du document lui-même, dont le statut 404 est vérifié à part.
   Témoin : politique sans empreintes, violations `script-src-elem` et `style-src-elem` exigées.
3. Tests sous F9a-MERGE : `error.spec.ts` identique à develop (`git diff develop HEAD` vide).
   `csp.e2e.ts` entre 85c6275 et HEAD : uniquement le fichier 404 servi sous `/en` (`en/404.html`) et
   le chemin `/en/accessibilite` corrigé en `/en/accessibility` (route réelle de F7) ; aucune assertion
   affaiblie. `audit.log` : 4 lignes pour 417c0ce4 (1 octroi, 1 usage `error.spec.ts`, 2 usages
   `csp.e2e.ts`), aucun autre chemin.

## Non fait (non demandé)

Pas de retrait de test au hasard, de tests de réserve OpenAPI ni d'analyse de cycles : recette ciblée
demandée par l'orchestrateur, lot sans changement d'API.

## Points ouverts

- Comptes rendus du lead périmés (section « fusion en cours », « Non fait ») : à annoter par l'orchestrateur.
- Revérifier l'alignement avec `scripts/deploy/csp-hashes.mjs` à la fusion du lot 24 (comparé ici à la branche).

## Verdict : accepté
