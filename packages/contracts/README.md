# @siteperso/contracts

Schémas Zod partagés (API, front) et génération du contrat OpenAPI 3.2.0 de l'API en lecture seule
(`info.version` 1.0.0 = version du contrat). Ce contrat est celui que le portage Rust devra honorer
à l'identique.

## Contenu

- `src/common/` : schémas transverses (`Locale`, `LocaleQuery`, `Slug`, `IsoDate`, `Image`,
  enums `ExperienceKind`, `ContractType`, `WorkMode`, `CefrLevel` et leurs constantes `LOCALES`,
  `EXPERIENCE_KINDS`, `CONTRACT_TYPES`, `WORK_MODES`, `CEFR_LEVELS`), `ProblemDetails` (RFC 9457),
  helper `nullable`.
- `src/<ressource>/` : un dossier par ressource de docs/01 (`profile`, `social-links`, `skills`,
  `skill-groups`, `experiences`, `projects`, `tools`, `resources`, `certifications`, `education`,
  `languages`), plus `cv` (agrégat de `GET /cv`) et `health`. Chaque fichier exporte
  `XxxSchema` et le type `Xxx` (`z.infer`).
- `src/openapi/document.ts` : assemblage du document OpenAPI (`createOpenApiDocument()`) : 13 chemins
  relatifs à `/api/v1`, paramètre `lang`, réponses 200/400/404/429/500 (503 pour `/health`).
- `scripts/export-openapi.ts` : écrit `dist/openapi.json` (déterministe : exécuté par `pnpm build`).
- `*.fixtures.ts` : exemples de test, exclus du build.

## Conventions du contrat

- **Propriétés JSON en camelCase** (`firstName`, `dateStart`, `groupSlug`), comme `HealthResponse`
  et `ProblemDetails` au lot 0. Les colonnes SQL restent en snake_case : la traduction est faite
  par les dépôts. Côté Rust : `#[serde(rename_all = "camelCase")]`.
- **Objets de réponse stricts** (`.strictObject`, `additionalProperties: false`) : une clé inconnue
  est refusée, pour que les tests e2e détectent toute fuite de colonne (e-mail, `sort_order`…).
- **Nullable = requis avec valeur `null`** : un champ nullable est toujours présent dans la réponse
  (jamais omis). Utiliser `nullable(Schema)` (union `schema | null`) pour un schéma qui porte un
  `id`, jamais `.nullable()` : le générateur propagerait le `null` dans le composant partagé.
  `.nullable()` reste correct sur `z.string()`, `z.url()`, `z.int()`.
- **Pas de `.default()` dans un schéma de réponse** (le champ deviendrait optionnel) : le `default`
  est une annotation `.meta()`. Seul `LocaleQuery` (entrée) a un `.default('fr')`.
- **Dates** : `IsoDate` = `YYYY-MM-DD` (`format: date`), validée au calendrier (`2026-02-30` refusé).
  Les années (`year`, `yearStart`, `yearEnd`) sont des entiers.
- **Enums** en minuscules (`employment`, `cdi`, `hybrid`), niveaux CECRL en majuscules (`C1`).
- **Raffinement non exprimable en OpenAPI** : `Education.yearEnd >= yearStart` (vérifié par Zod,
  à reproduire côté Rust).
- Les tableaux (`/social-links`, `/skills`…) sont renvoyés tels quels, déjà triés par `sort_order`
  (`date_start` décroissant pour les expériences).

## Choix de la bibliothèque OpenAPI

`@asteasolutions/zod-to-openapi` (générateur `OpenApiGeneratorV32`) : seule bibliothèque Zod 4
qui émet de l'OpenAPI 3.2.0, la plus haute version que `utoipa` 6 sait produire côté Rust
(`zod-openapi` s'arrête à 3.1). Elle lit les métadonnées natives de Zod 4
(`.meta({ id, description })`) : pas d'appel à `extendZodWithOpenApi`, pas de `.openapi()`,
les schémas restent du Zod ordinaire, réutilisables tels quels par le front.

Les tests valident le document avec `@scalar/openapi-parser` (dépendance de dev, reconnaît 3.2).

## Ajouter une route

Déclarer le schéma dans `src/<ressource>/`, l'exporter dans `src/index.ts`, puis ajouter une entrée
à `contentRoutes` (et le schéma à `namedSchemas`) dans `src/openapi/document.ts`. Les schémas
nommés doivent être passés au générateur comme `{ type: 'schema', schema }` pour être publiés
dans `components.schemas` même sans référence directe.

## Commandes

```sh
pnpm --filter @siteperso/contracts build          # dist/ (JS + d.ts) et dist/openapi.json
pnpm --filter @siteperso/contracts test           # tests unitaires Vitest
pnpm --filter @siteperso/contracts openapi:export # régénère dist/openapi.json seul
```
