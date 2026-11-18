# @siteperso/contracts

Schémas Zod partagés (API, front) et génération du contrat OpenAPI 3.2.0 de l'API
(`info.version` 1.0.0 = version du contrat).

## Contenu

- `src/common/` : schémas transverses (`Locale`, `LocaleQuery`, `ProblemDetails`).
- `src/health/` : réponse de `GET /health`.
- `src/openapi/document.ts` : assemblage du document OpenAPI (`createOpenApiDocument()`).
- `scripts/export-openapi.ts` : écrit `dist/openapi.json` (exécuté par `pnpm build`).

Chaque ressource de l'API (lot 2) ajoute un dossier `src/<resource>/` avec ses schémas, puis
déclare ses routes dans `src/openapi/document.ts` (`routes`, et `namedSchemas` pour les
schémas à publier dans `components.schemas`). Les chemins sont relatifs à `/api/v1`.

## Choix de la bibliothèque OpenAPI

`@asteasolutions/zod-to-openapi` (générateur `OpenApiGeneratorV32`) : seule bibliothèque Zod 4
qui émet de l'OpenAPI 3.2.0, la plus haute version que `utoipa` 6 sait produire côté Rust
(`zod-openapi` s'arrête à 3.1). Elle lit les métadonnées natives de Zod 4
(`.meta({ id, description })`) : pas d'appel à `extendZodWithOpenApi`, pas de `.openapi()`,
les schémas restent du Zod ordinaire, réutilisables tels quels par le front.

## Commandes

```sh
pnpm --filter @siteperso/contracts build          # dist/ (JS + d.ts) et dist/openapi.json
pnpm --filter @siteperso/contracts test           # tests unitaires Vitest
pnpm --filter @siteperso/contracts openapi:export # régénère dist/openapi.json seul
```
