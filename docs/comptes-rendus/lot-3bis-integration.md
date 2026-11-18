# Lot 3 bis : intégration (câblage de `cv` et alignements)

Branche `lot/3bis-cv-integration` (dérivée de `v3/backend`, lots 0, 1, 2, 5 et les deux branches du
lot 3 fusionnés). Agent d'intégration mandaté par l'orchestrateur : fichiers partagés touchés
uniquement ceux du brief (`apps/api/test/errors.e2e-spec.ts`, `packages/contracts/src/projects/` et
`education/`, `apps/api/src/infrastructure/db/translated.ts` et les dépôts Drizzle), en plus des
dossiers `cv`. Un commit atomique par point.

## Fait

1. **L3-13, câblage de `cv`** : `CvModule` importe les 10 modules de ressources et fournit
   `GetCvUseCase` par `useFactory` + `inject` des 10 cas d'usage exportés, dans l'ordre du
   constructeur. `CvController` : `LocaleQuerySchema.safeParse` (400 problem+json), réponse validée par
   `CvSchema` strict. Test e2e `apps/api/test/cv.e2e-spec.ts` : 200 validé (7 groupes, 8 expériences,
   2 langues), `?lang=en` → `locale: 'en'`, `cv.experiences` strictement égal (`toStrictEqual`) à
   `/experiences` en `fr` et en `en`, `?lang=de` → 400, durée mesurée. `errors.e2e-spec.ts` : `cv`
   retiré de `PENDING_RESOURCES`, la liste était vide donc le `it.each` est supprimé (les trois cas
   restants ne dépendent d'aucune ressource).
2. **Contrats alignés sur le SQL** : `Project.year` et `Education.description` nullables. Les cas
   d'usage `projects` (plus d'erreur 500 sur une année absente) et `education` (plus de `''` de
   substitution) renvoient `null` ; les dépôts Drizzle remontaient déjà `null`, la substitution était
   dans les cas d'usage. Specs de contrats, tests unitaires et e2e ajustés (fixture de projet sans
   année, formation seedée sans description attendue `null`).
3. **Helper de repli de langue** : `apps/api/src/infrastructure/db/translated.ts` (`translated<T>`,
   `translatedOrEmpty`) remplace les trois copies locales et les `sql\`coalesce(...)\`` en ligne des
   11 dépôts et de `selectPublishedSkills`. SQL produit identique (test unitaire du SQL rendu par
   `PgDialect`), e2e inchangés.
4. **Resources** : la jointure vers `skill_groups` est limitée aux groupes `published` ; sinon
   `groupSlug` est `null`. e2e : groupe dépublié puis restauré.
5. Vérifié : `pnpm check` vert (lint, typecheck, 75 tests contrats, 81 tests unitaires API, 107 e2e).
   API démarrée après `db:up`/`migrate`/`seed` : `GET /cv` en `fr` et `?lang=en` renvoient 200 validés par
   `CvSchema` (93 ms à froid, 16 ms ensuite), `?lang=de` renvoie 400, aucun `@` dans la réponse.

## Non fait

- Rien du brief. Les divergences contrat/SQL non alignées sont listées en points ouverts.

## Décisions prises

1. **Dix cas d'usage, pas onze** : le constructeur de `GetCvUseCase` en attend dix (les clés de
   `CvSchema`, `locale` exclue), `ListSkillsUseCase` n'en fait pas partie (compétences imbriquées dans
   `skillGroups`). Le câblage s'y conforme ; aucune adaptation de signature n'a été nécessaire, les
   classes de l'agent A satisfont structurellement `LocalizedUseCase<T>`.
2. **Assertion de durée souple** : le seuil du backlog est 200 ms en local ; le test mesure une
   deuxième requête (après échauffement) et n'échoue qu'au-delà de 5 fois le seuil (1 s), pour ne pas
   être instable en CI ou sous `pnpm check`. Mesure réelle : de l'ordre de 15 à 100 ms.
3. **`translatedOrEmpty`** : `skill_groups_translations.description` reste exposé en chaîne (`''`),
   le contrat `SkillGroup` n'étant pas dans le périmètre autorisé ; la logique est isolée dans le
   helper pour être retirée en une ligne si le contrat devient nullable.
4. **Typage de `translated`** : `SQL<NoInfer<T>>` pour que `translated(a, b)` sans argument de type
   vaille `string` (sans `NoInfer`, TypeScript infère `unknown` depuis le contexte de `select`).
5. **Images** : une image sans texte alternatif reste renvoyée `null` (`projects`, `resources`,
   logo d'expérience), comportement conservé : `Image.alt` est exigé pour l'accessibilité.
6. Port de l'API de recette : `PORT=3072` dans le `apps/api/.env` local (gitignoré), pour ne pas
   entrer en collision avec un autre worktree.

## Points ouverts

- **`SkillGroup.description`** : nullable en SQL (null dans tout le seed), requise en chaîne dans le
  contrat, donc `''` dans la réponse. Non aligné : `packages/contracts/src/skill-groups/` hors du
  périmètre autorisé. À passer en `nullable` par l'orchestrateur si souhaité (changer
  `translatedOrEmpty` en `translated<string | null>` et le cas d'usage).
- **Textes alternatifs d'images** (`profile_translations.picture_alt` est `not null` ; `image_alt`,
  `picture_alt`, `logo_alt` sont nullables pour projects, resources, experiences) : volontairement non
  alignés, `ImageSchema.alt` reste exigé ; l'image est `null` sans alternative.
- **Contraintes de plage plus strictes dans le contrat que dans le SQL** : `Education.yearStart` /
  `yearEnd` (1950 à 2100) et `Project.year` (1990 à 2100) n'ont pas de `check` en SQL (seul
  `certifications.year` a `between 1990 and 2100`). Une valeur hors plage donnerait un 500
  générique. Aucune donnée concernée aujourd'hui ; ajouter un `check` SQL (lot base de données) si on
  veut garantir la cohérence.
- **Chaînes non vides** : le contrat impose `min(1)` sur plusieurs colonnes `text not null` sans
  `check (<> '')` en SQL (noms, titres, `kind`, `family`…). Même remarque, sans effet sur le seed.
- **`image_alt` unique** pour les deux captures d'un projet (docs/01) : desktop et mobile partagent
  le même texte.
- Les e2e `projects`/`tools`/`resources` s'appuient sur des slugs seedés (`typescript`, `nodejs`,
  `languages-frameworks`) : un renommage dans les seeds les casserait.
- Les liens `github` et `website` manquent toujours dans le seed (P1 du lot 1) : `/cv` ne renvoie que
  LinkedIn dans `socialLinks`.
