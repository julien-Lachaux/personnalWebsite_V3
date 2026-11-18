# Lot 3 : Dev API B

Branche `lot/3-api-b` (dérivée de `v3/backend`). Périmètre tenu : dossiers `projects`, `tools`,
`resources`, `certifications`, `education` (domain, application, infrastructure/db, infrastructure/http,
`apps/api/test/<resource>.e2e-spec.ts`), `apps/api/src/application/cv/` et ce compte rendu. Aucun
fichier partagé modifié, aucun contrat modifié.

## Fait

- L3-08 `projects` : `GET /api/v1/projects`. Deux requêtes (projets, puis compétences via
  `project_skills` joint à `skills`, `skill_groups` et leurs traductions), pas de N+1. `imageDesktop` et
  `imageMobile` en `Image | null`. Tests unitaires (5) et e2e (7) : `[]` sur base seedée, fixtures (2
  projets publiés, 1 non publié, 2 compétences à l'ordre de lien inversé), repli `en` vers `fr`, `lang=de` en 400.
- L3-09 `tools` : une requête, repli en SQL. Tests unitaires (4) et e2e (6).
- L3-10 `resources` : une requête, `groupSlug` par `left join skill_groups` (null sans groupe). Tests
  unitaires (4) et e2e (6).
- L3-11 `certifications` : les 3 certifications seedées, tri `sort_order`, `en` présent, repli testé par
  suppression des lignes `en` puis `resetTestDatabase()`, filtrage `published`. Tests unitaires (4) et e2e (5).
- L3-12 `education` : 3 formations seedées dont `yearEnd` null. Tests unitaires (5) et e2e (6).
- L3-13 (partie autonome) `src/application/cv/get-cv.use-case.ts` : `GetCvUseCase`, classe pure, 10
  dépendances `LocalizedUseCase<T> = { execute(locale) }` typées sur les contrats, `Promise.all`,
  `CvSchema.parse` (strict) du résultat avec `locale`. 14 tests unitaires avec doublures : composition,
  langue transmise, parallélisme (les 10 appels partent avant toute résolution), rejet de l'ensemble si
  un seul cas d'usage échoue (un test par cas d'usage), donnée invalide rejetée.
- Chaque module exporte son cas d'usage (`exports: [List<Resource>UseCase]`), prêt pour `CvModule`.
- Patron respecté partout : domaine, port + jeton `Symbol`, cas d'usage sans décorateur, dépôt Drizzle
  (`@Injectable`, `useClass`), controller (`LocaleQuerySchema.safeParse`, 400 `BadRequestException`,
  réponse validée par `Schema.array().parse`), module avec `useFactory`/`inject`.
- Vérification : lint, typecheck, tests unitaires (54) verts ; e2e de mes 5 modules verts (30 tests). Voir
  « Changements partagés » pour l'unique échec e2e restant de la branche.

## Non fait (volontairement, voir consigne de l'orchestrateur)

- Câblage de `cv` : `infrastructure/http/cv/` (controller 501 et module) intact, pas de
  `test/cv.e2e-spec.ts`. À faire après fusion des branches A et B (voir ci-dessous).
- Le critère « `/cv` < 200 ms » et l'égalité `cv.experiences` / `/experiences` sont donc à vérifier à
  l'intégration.

## Changements partagés demandés à l'orchestrateur

1. `apps/api/test/errors.e2e-spec.ts` : retirer `'projects'`, `'tools'`, `'resources'`,
   `'certifications'`, `'education'` de `PENDING_RESOURCES` (ces routes ne répondent plus 501). Sans cela,
   5 tests e2e échouent (`GET /api/v1/<resource> répond 501 Not Implemented`). L'agent A doit retirer les
   siennes (`profile`, `social-links`, `skill-groups`, `skills`, `experiences`, `languages`) dans la même
   liste : conflit de fusion attendu, résolution = ne garder que `'cv'`. Je ne l'ai pas modifié : fichier
   hors périmètre.
2. Câblage `cv` (agent dédié après fusion) :
   - `CvModule` : `imports` des 10 modules (`ProfileModule`, `SocialLinksModule`, `SkillGroupsModule`,
     `ExperiencesModule`, `ProjectsModule`, `ToolsModule`, `ResourcesModule`, `CertificationsModule`,
     `EducationModule`, `LanguagesModule`), `GetCvUseCase` fourni par `useFactory` avec
     `inject: [GetProfileUseCase, ListSocialLinksUseCase, ListSkillGroupsUseCase, ListExperiencesUseCase,
     ListProjectsUseCase, ListToolsUseCase, ListResourcesUseCase, ListCertificationsUseCase,
     ListEducationUseCase, ListLanguagesUseCase]` **dans cet ordre exact** : c'est l'ordre des paramètres du
     constructeur de `GetCvUseCase` (ordre des clés de `CvSchema`, `locale` exclue).
   - Controller `GET /cv` : `LocaleQuerySchema.safeParse`, `GetCvUseCase.execute(lang)`, `CvSchema.parse`
     (déjà fait par le cas d'usage, redoublé par convention).
   - Les classes de l'agent A doivent satisfaire `{ execute(locale: Locale): Promise<T> }` ; sinon `tsc`
     le dira au câblage.

## Décisions prises

1. **Dix cas d'usage dans `GetCvUseCase`, pas onze** : `CvSchema` a dix clés de données (plus `locale`),
   les compétences sont imbriquées dans `skillGroups`. `ListSkillsUseCase` n'est pas utilisé par le CV
   (le backlog L3-13 dit « 10 »).
2. **Image exposée seulement avec chemin ET texte alternatif** (`projects`, `resources`) : `ImageSchema`
   impose `alt` non vide, alors que `image_alt`/`picture_alt` sont nullables en SQL. Une image sans
   alternative devient `null` plutôt que de casser la validation ou d'inventer un texte. La logique est
   dans le cas d'usage (`toImage`), testée.
3. **`education.description` null en SQL devient `''`** dans la réponse (le contrat est `z.string()`).
   Cas réel dans le seed (`openclassrooms-integrateur-web`).
4. **Un projet sans `year` fait échouer le cas d'usage** (500 générique) : le contrat exige l'année alors
   que le SQL l'autorise nulle (voir points ouverts).
5. `coalesce(en, fr)` appliqué aussi aux champs nullables (`image_alt`, `description`) : une valeur `en`
   nulle retombe sur la valeur `fr`. Pour `lang = fr`, la jointure `en` porte sur `locale = 'fr'`
   (même ligne, résultat identique) plutôt qu'une jointure vide.
6. Compétences d'un projet : filtrées sur `skills.published` uniquement (pas sur le groupe).
7. Dépôts annotés `@Injectable()` et fournis par `useClass` comme le demande le backlog ; ce sont les
   seuls décorateurs Nest hors `infrastructure/http`.
8. Aucune donnée personnelle : fixtures de test fictives (`example.org`), seeds inchangés.

## Points ouverts

- **`Project.year` requis alors que `projects.year` est nullable** : à trancher (contrat `nullable` comme
  pour `url`/`repoUrl`, ou `not null` en SQL). Tant que c'est le cas, un projet sans année donne un 500.
  Les tables `projects`/`tools`/`resources` étant vides en seed, aucun effet aujourd'hui.
- **`Education.description` non nullable** dans le contrat alors que le SQL l'autorise nulle : la chaîne
  vide est un pis-aller ; un contrat `nullable` serait plus fidèle.
- **`image_alt` unique pour les deux captures d'un projet** (docs/01) : desktop et mobile partagent le même
  texte alternatif.
- **`Resource.groupSlug`** peut désigner un groupe non publié (la jointure ne filtre pas `published`).
  À filtrer si ce n'est pas souhaité.
- Les e2e `projects`/`tools`/`resources` s'appuient sur les compétences et le groupe seedés
  (`typescript`, `nodejs`, `languages-frameworks`) : un changement de slug dans les seeds les casserait.
- Les cas d'usage de l'agent A n'ont pas été vus : la compatibilité de leurs signatures avec
  `LocalizedUseCase<T>` est à vérifier au câblage de `cv`.
