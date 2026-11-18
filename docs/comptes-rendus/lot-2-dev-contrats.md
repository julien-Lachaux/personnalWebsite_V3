# Lot 2 : Dev contrats

Branche `lot/2-contrats` (dérivée de `v3/backend`). Périmètre tenu : `packages/contracts/**` et ce
compte rendu.

## Fait

- L2-01 : schémas communs `Slug`, `IsoDate`, `Image`, enums (`ExperienceKind`, `ContractType`,
  `WorkMode`, `CefrLevel`) et constantes (`LOCALES`, `EXPERIENCE_KINDS`, `CONTRACT_TYPES`,
  `WORK_MODES`, `CEFR_LEVELS`). `LocaleQuerySchema` conservé tel quel.
- L2-02 à L2-04 : `Profile`, `SocialLink`, `Skill`, `SkillGroup`, `Experience`, `Project`, `Tool`,
  `Resource`, `Certification`, `Education` (raffinement `yearEnd >= yearStart`), `Language`.
  Tous stricts, tous avec `.meta({ id, description })` et exemples.
- L2-05 : `CvSchema` (11 clés, `skills` non répété à plat, strict).
- L2-06 : document OpenAPI 3.2.0 complet : 13 chemins, paramètre `lang` sur 12, réponses
  200/400/404/429/500 (503 pour `/health`), 13 tags, 22 composants. Export déterministe
  (sha256 identique sur deux exécutions).
- L2-07 : `index.ts` exporte tout, `sideEffects: false`, README mis à jour, `index.spec.ts` avec
  `expectTypeOf`.
- Vérifié : critères d'acceptation de chaque ticket, `pnpm check` vert, `pnpm build` vert.

## Non fait

Rien du périmètre. Les tests e2e de l'API n'ont pas été étendus (hors périmètre, lot 3/4).

## Décisions prises

1. **camelCase pour les propriétés JSON**, comme `HealthResponse`/`ProblemDetails` (lot 0) et comme
   les noms du backlog. Documenté dans le README du paquet.
2. **`nullable(schema)` au lieu de `.nullable()` sur les schémas à `id`** (`src/common/nullable.ts`).
   Constat : `zod-to-openapi` 9.1.0 propage le `null` dans le composant partagé
   (`components.schemas.Image` deviendrait `["object","null"]`) et perd le `null` à l'usage. L'union
   `schema | null` donne un `anyOf: [{$ref}, {type: 'null'}]` exact. `.nullable()` reste utilisé sur
   les types primitifs.
3. **Les schémas nommés sont passés au générateur en `{ type: 'schema', schema }`** : sinon un schéma
   non référencé par une route n'apparaît pas dans `components.schemas` (constat du lot 0 : la
   liste `namedSchemas` était sans effet).
4. **Validateur OpenAPI 3.2 : `@scalar/openapi-parser` 0.29.25** (dev). Choisi car il reconnaît la
   3.2 (vérifié : `version: '3.2'`, rejette un document cassé) ; `@readme/openapi-parser` 10 et
   `@apidevtools/swagger-parser` 13 annoncent 3.1 au maximum.
5. **Objets de réponse stricts** (`additionalProperties: false` dans le document). `Image` aussi.
6. **Les propriétés qui référencent un composant (`Image`, `IsoDate`, `Slug`, enums) n'ont pas de
   `.meta({ description })` supplémentaire** (le générateur inlinerait le composant) ; la
   description vit sur le composant. Les unions nullable gardent leur description.
7. **Bornes** : `year` 1990-2100, `yearStart`/`yearEnd` 1950-2100, `level` entier 1-5, `code` de
   langue `^[a-z]{2}$`, textes obligatoires `min(1)`, URLs `z.url()` (`format: uri`).
8. **`SocialLink.kind` reste une chaîne ouverte** (docs/01 : `github`, `linkedin`, `website`, …).
9. Fixtures de test dans `src/cv/cv.fixtures.ts`, exclues de `tsconfig.build.json`.
10. 404 documenté sur toutes les routes de contenu (le backlog le demande ; il couvre la ressource
    absente, par exemple `/profile` sans ligne).

## Points ouverts

- **`Project.repoUrl` non nullable** (suit le backlog : « `url`, `repoUrl` » sans null). Si le seed
  contient un projet privé sans dépôt, il faut le passer en `nullable` : à trancher avec le lot 1
  avant le lot 3. De même `Project.url` et `Tool.iconPath` sont requis.
- **`Resource.groupSlug`** : renvoie le slug du `skill_groups` référencé ; l'API devra joindre.
- **`Education`** : le raffinement n'est pas exprimable en OpenAPI ; à reproduire côté Rust.
- **Exemples** : le champ `examples` est présent sur les champs principaux, pas sur chaque réponse
  (pas de `example` d'objet complet dans les opérations). À ajouter si le front le souhaite.
- Le contrôleur de chaque ressource (lot 3) doit renvoyer exactement ces formes (`safeParse` sur la
  réponse recommandé en test e2e) ; `LocaleQuerySchema` est la source du paramètre `lang`.
- Le backlog (L2-06) écrit « paramètre `lang` sur 12 d'entre eux » : c'est le cas (13 chemins moins
  `/health`).
- Dépendance de dev ajoutée au paquet contracts : `@scalar/openapi-parser` 0.29.25
  (`pnpm-lock.yaml` mis à jour : fichier de config racine touché par `pnpm add`, inévitable).
