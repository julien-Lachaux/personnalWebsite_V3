# @siteperso/contracts

Schémas Zod partagés (API, front) et génération du contrat OpenAPI 3.1 de l'API.

## Contenu

- `src/common/` : schémas transverses (`Locale`, `LocaleQuery`, `ProblemDetails`).
- `src/health/` : réponse de `GET /health`.
- `src/openapi/document.ts` : assemblage du document OpenAPI (`createOpenApiDocument()`).
- `scripts/export-openapi.ts` : écrit `dist/openapi.json` (exécuté par `pnpm build`).

Chaque ressource de l'API (lot 2) ajoute un dossier `src/<resource>/` avec ses schémas, puis
déclare ses chemins dans `src/openapi/document.ts`. Les chemins sont relatifs à `/api/v1`.

## Choix de la bibliothèque OpenAPI

`zod-openapi` : elle lit les métadonnées natives de Zod 4 (`.meta({ id, description })`) sans
patcher le prototype de Zod ni imposer de registre parallèle, et produit directement de l'OpenAPI
3.1 ; les schémas restent du Zod ordinaire, réutilisables tels quels par le front.

## Commandes

```sh
pnpm --filter @siteperso/contracts build          # dist/ (JS + d.ts) et dist/openapi.json
pnpm --filter @siteperso/contracts test           # tests unitaires Vitest
pnpm --filter @siteperso/contracts openapi:export # régénère dist/openapi.json seul
```
