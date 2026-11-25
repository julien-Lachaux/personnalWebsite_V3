# Lot F3a, DevOps : ajustement de la CI (ticket F3a-CI)

## Fait

`.github/workflows/ci.yml` : `NUXT_CV_SOURCE: fixtures` et `NUXT_PUBLIC_CONTACT_EMAIL: contact@example.org`
posés en `env:` de deux étapes seulement (rien d'autre modifié), à reporter par le lot 14 :

- job `qualite`, étape `pnpm build` ;
- job `front`, étape `pnpm turbo run lint typecheck test:coverage test:e2e --filter=@siteperso/web`.

Preuves : `pnpm build` sans les variables, code 1 (`@siteperso/web#build` échoue) ; avec, code 0.
`actionlint` (image `rhysd/actionlint:latest`, non épinglée par digest, usage ponctuel) : aucune alerte.
`TURBO_FORCE=true pnpm check` : code 0. `pnpm integrity develop` : voir le commit.

## Décisions

- Job `e2e` (`pnpm test:coverage`) et `mutation` : pas de `generate`, rien à poser.
- Le script `test:e2e` du front pose déjà ces variables (`generate:fixtures`) : l'ajout au job `front`
  est une sécurité pour toute étape de ce job qui génère.
- Job `pile-locale` : `stack:up` ne construit pas encore le front (brief back-005) ; à revoir à F9.

## Points ouverts

- Épingler l'image actionlint par digest si on l'intègre durablement.
