# Lot 15, étape 2 : contrat, domaine, dépôts, routes et tests (dev-api)

Branche `lot/15-brief-back-001` (depuis e71333e, fin de l'étape 1). Source : `docs/briefs/back-001-donnees-front.md`
(BF-1 à BF-7), `docs/04-front-donnees.md`, compte rendu de l'étape 1. Isolation Docker `siteperso-v3-lot15`
(ports 5712 et 5713), `.env` non modifiés ; `pnpm db:down` en fin d'étape. Autorisation « tests » ab03b52f
(ticket BF-API) pour les tests rendus obsolètes par le brief.

Un commit par ticket, chacun avec contrat Zod, domaine, port, dépôt, contrôleur, OpenAPI et tests, `pnpm check`
vert avant chaque commit (e2e compris) :

| Ticket | Commit | Sujet |
| --- | --- | --- |
| BF-1 | 65061aa | feat(api): profil restructuré, contrat et dépôt (BF-1) |
| BF-2 | b4b2a90 | feat(api): compétences d'expérience affichées ou cachées, shownInStack (BF-2) |
| BF-3 | ef1f46e | feat(api): rang de la stack principale des compétences, mainStackOrder (BF-3) |
| BF-6 | a4a1d9c | test(api): lien des recommandations LinkedIn servi sans changement de contrat (BF-6) |
| BF-4 | 02b3d8b | feat(api): ressource recommendations et clé recommendations du CV (BF-4) |
| BF-5 | f986d08 | feat(api): ressource ai-overview et clé aiOverview du CV (BF-5) |
| BF-7 | (dans chaque commit) | routes, schémas nommés, étiquettes et instantané OpenAPI au fil des tickets |
| BF-1, BF-3, BF-4 | 117a0ad | test(api): doublures proxy des dépôts profil, recommandations, compétences et expériences |

Résultat final : voir « Vérifications » en fin de document.

## Fait, par ticket

- **BF-1** : `Profile` (et `Cv.profile`) perd `headline`, `bio`, `availability` et gagne `titleBadge`,
  `taglines: string[]` (au moins une, aucune vide), `intro`, `mission`, `currentActivity`, `seekingFormat`,
  `seekingLocation`, `seekingAvailability`, `cvPath`, tous non vides. Domaine, cas d'usage (copie des
  accroches), dépôt (les neuf colonnes, encore nullables) mis à jour. `info.version` reste 1.0.0.
- **BF-2** : nouveau schéma nommé `ExperienceSkill` = `Skill` + `shownInStack: boolean`, utilisé par
  `Experience.skills` (donc `/experiences` et `/cv`). Objet plat strict (pas d'`allOf`), lu dans la même requête
  que les compétences de l'expérience (`experience_skills.shown_in_stack`), pas de N+1. Les liens cachés restent
  servis, à leur rang de `sort_order` : ce sont les mots-clés du filtre du front (docs/04).
- **BF-3** : `Skill.mainStackOrder: number | null` (entier >= 1 ou `null`, toujours présent). Lu par la requête de
  base des compétences (`select-published-skills.ts`), donc présent partout où `Skill` est imbriqué : `/skills`,
  `/skill-groups`, `/experiences`, `/projects`, `/ai-overview` et `/cv`. L'ordre des listes ne change pas.
- **BF-6** : vérifié, aucun changement de contrat ni de code : le lien est une ligne de `social_links` que le
  contrat `SocialLink` décrit déjà (kind ouvert, URL http(s), libellé traduit). Un e2e le prouve dans les deux
  langues, et l'égalité avec `cv.socialLinks`.
- **BF-4** : ressource complète `recommendations` (domaine, port + jeton, cas d'usage pur, dépôt Drizzle en une
  requête, contrôleur `safeParse` + réponse validée, module `useFactory`, enregistré dans `AppModule`, agrégé par
  `CvModule`). Schéma nommé `Recommendation` (`slug`, `authorName`, `authorRole`, `relationship`,
  `recommendedOn` en `IsoDate`, `paragraphs` non vide, `locale`). Tri `sort_order` puis `id` ; `published` et
  `deleted_at is null` filtrés. Clé `Cv.recommendations` requise.
- **BF-5** : ressource complète `ai-overview`. Schéma nommé `AiOverview` (`title`, `inProductLabel`,
  `inProductItems` non vide, `dailyLabel`, `dailyText`, `skills: Skill[]`). Deux requêtes lancées ensemble : la
  ligne unique traduite (repli par ligne), puis ses compétences publiées (requête de base des compétences, groupe
  publié exigé) triées par `ai_overview_skills.sort_order` puis `id`. Clé `Cv.aiOverview` requise et nullable.
- **BF-7** : chaque ticket ajoute ses routes (`listRecommendations`, `getAiOverview`), ses schémas nommés
  (`ExperienceSkill`, `Recommendation`, `AiOverview`) et ses étiquettes (`Recommandations`, `IA`) dans
  `document.ts` ; descriptions en français dans `.meta()`, aucun `.default()` dans un schéma de réponse (le test
  existant le vérifie toujours). Document : 15 chemins, 25 composants, OpenAPI 3.2.0. L'instantané
  `openapi.json` a été régénéré à chaque ticket hors de l'arbre (script de rendu identique au test, dans le
  dossier temporaire de session), puis copié ; chaque diff relu : il ne contient que ce que le ticket ajoute ou
  retire (aucun autre libellé touché).
- 405 sur les nouvelles routes : produit par le mécanisme générique de `create-app.ts` (aucune ligne à ajouter),
  prouvé par les e2e (`POST`, `PUT`, `PATCH`, `DELETE` → 405 problem+json, `Allow: GET, HEAD, OPTIONS`).

## Décisions

- **BF-1, valeur nulle non servie : la ligne incomplète est ignorée, pas d'erreur.** Le dépôt pose, dans les deux
  jointures de `profile_translations`, une condition de complétude : chaque colonne du design v6 `<> ''` (faux
  pour `null`), `taglines` d'au moins un élément, sans élément vide ni nul. Conséquences : une ligne `en`
  incomplète est traitée comme absente et la ligne `fr` est servie entière ; une ligne `fr` incomplète donne « pas
  de profil » (404 pour `/profile`, et 404 pour `/cv`, comme un profil absent). Pourquoi : c'est exactement la
  règle du repli par ligne (docs/01, RC-7) appliquée à une ligne qui ne peut pas être servie entière ; une
  erreur 500 aurait fait tomber `/cv` pour une traduction `en` lacunaire saisie à la main, alors que le repli sur
  le `fr` est le comportement documenté. Jamais de champ nul servi, jamais de mélange de langues. Le type non nul
  est porté par un helper `present()` (sans effet sur le SQL), à retirer à l'étape 3.
- **BF-1, `cvPath`** : contraint au-delà de « non vide » : chemin relatif à la racine du site, un seul `/` en tête,
  sans espace (`^/[^/\s]\S*$`). Le front le rend dans un `href` : même raison que `HttpUrlSchema` (lot 8), une
  valeur `javascript:`, `data:`, une URL absolue ou sans protocole (`//hôte`) est refusée par le contrat.
- **BF-2** : schéma nommé distinct `ExperienceSkill` plutôt qu'un champ ajouté à `Skill` : `shownInStack` est une
  propriété du lien expérience-compétence, pas de la compétence ; `/skills` et `/skill-groups` n'en ont pas
  l'usage. Défini par recopie de `SkillSchema.shape` (objet plat) pour que le JSON Schema reste strict sans
  `allOf` (un `allOf` de deux objets `additionalProperties: false` serait insatisfaisable).
- **BF-3** : champ de `Skill`, donc présent dans toute compétence imbriquée (un seul type `Skill` pour le portage
  Rust). Aucun tri par rang côté API : docs/04 dit que le front filtre `mainStackOrder != null` et trie.
- **BF-4, `locale`** : lue par le même `translated(en, fr, 'locale')` que les champs, donc toujours la langue de la
  ligne réellement servie, jamais celle de la requête. Clé `recommendations` ajoutée en fin de `Cv` (ordre des
  clés = ordre du constructeur de `GetCvUseCase`).
- **BF-5, absence : 404 pour la route, `aiOverview: null` dans `/cv`.** docs/04 ne dit rien de l'absence ; le
  front affiche une section optionnelle, alors que le profil est indispensable (sans profil, `/cv` reste 404).
  Faire échouer toute la génération statique pour une section facultative serait disproportionné. Deux cas
  d'usage purs : `FindAiOverviewUseCase` (section ou `null`, exporté pour `CvModule`) et `GetAiOverviewUseCase`
  (lève `EntityNotFoundError('Section IA', 'ai-overview')`, détail « Section IA « ai-overview » introuvable. »).
  « Absente » couvre : ligne absente, marquée `deleted_at`, ou sans traduction `fr` (le `fr` reste obligatoire).
  `ai_overview` n'a pas de `published` (étape 1) : non filtré.
- Tests de nouvelles fonctions dans de nouveaux fichiers (`*.front*.spec.ts`, `*-front.e2e-spec.ts`,
  `recommendations.e2e-spec.ts`, `ai-overview.e2e-spec.ts`…) : les tests existants ne sont modifiés que là où le
  contrat les rend faux.

## Écarts au brief, par ticket

- **BF-1** : `cvPath` porte un motif (chemin relatif à la racine du site) en plus de « non vide » ; décision de
  sécurité expliquée plus haut. Lecture transitoire avec condition de complétude, tant que les colonnes sont
  nullables (étape 3).
- **BF-2** : aucun. Nom de schéma ajouté : `ExperienceSkill`.
- **BF-3** : le brief cite `/skills`, `/skill-groups`, `/cv` ; le champ apparaît aussi dans `/experiences`,
  `/projects` et `/ai-overview`, parce que c'est un champ de `Skill`. Le schéma `Project` lui-même ne change pas,
  et aucun fichier source de `projects` n'a changé (le cas d'usage recopie déjà la compétence entière) ; seul le
  test unitaire `list-projects.use-case.spec.ts` a reçu le champ dans ses compétences. À trancher par Julien si
  « pas de changement sur projects » devait aussi exclure ce champ imbriqué.
- **BF-4** : aucun dans l'API. Rappel : l'étape 1 a seedé `published = true` (décision de Julien du 19 nov.) ; docs/04
  parle encore d'un état vide prévu par le front.
- **BF-5** : aucun ; choix `null` dans `/cv` documenté dans le contrat (description de `Cv.aiOverview`).
- **BF-6** : aucun ; rien à changer dans le contrat, vérifié.
- **BF-7** : pas de commit séparé : fait dans chaque commit de ticket, comme demandé.

## Tests existants modifiés (autorisation « tests » ab03b52f, ticket BF-API)

Chaque commit porte `Justification-test: BF-n <raison>`. Seules les données ou les comptes que le contrat rend
faux changent ; aucune autre assertion n'est touchée.

| Fichier | Test ou donnée | Avant | Après | Ticket |
| --- | --- | --- | --- | --- |
| `contracts/src/profile/profile.spec.ts` | `valid` | `title` « Développeur full-stack TypeScript senior », `headline`, `bio`, `availability` | `title` « Développeur full-stack » + les 9 nouveaux champs, sans les 3 anciens | BF-1 |
| `contracts/src/cv/cv.fixtures.ts` | `cvExample.profile` | idem | idem | BF-1 |
| `api/src/application/profile/get-profile.use-case.spec.ts` | `profile` (domaine) | idem | idem | BF-1 |
| `api/src/application/cv/get-cv.use-case.spec.ts` | `data.profile` | idem | idem | BF-1 |
| `api/src/infrastructure/http/controllers.spec.ts` | `profile` | `headline`, `bio`, `availability` | les 9 nouveaux champs | BF-1 |
| `contracts/src/experiences/experiences.spec.ts` | `skill` | 6 champs | + `shownInStack: true` (BF-2), + `mainStackOrder: 1` (BF-3) | BF-2, BF-3 |
| `contracts/src/cv/cv.fixtures.ts` | `experiences[0].skills` | `[skillExample]` | `[{ …, shownInStack: true }, { ocr, mainStackOrder: null, shownInStack: false }]` | BF-2, BF-3 |
| `contracts/src/openapi/document.spec.ts` | « publie tous les composants nommés » | 22 composants | + `ExperienceSkill` (BF-2), `Recommendation` (BF-4), `AiOverview` (BF-5) | BF-2, BF-4, BF-5 |
| `api/src/application/experiences/list-experiences.use-case.spec.ts` | `employment.skills[0]` | 6 champs | + `mainStackOrder: 1`, `shownInStack: true` | BF-2, BF-3 |
| `api/src/application/cv/get-cv.use-case.spec.ts` | `data.experiences[0].skills`, `skill` | `[skill]`, 6 champs | `[{ ...skill, shownInStack: true }]`, + `mainStackOrder: 1` | BF-2, BF-3 |
| `contracts/src/skills/skills.spec.ts` | `valid` | 6 champs | + `mainStackOrder: null` | BF-3 |
| `contracts/src/skill-groups/skill-groups.spec.ts` | `skill` | 6 champs | + `mainStackOrder: 1` | BF-3 |
| `contracts/src/cv/cv.fixtures.ts` | `skillExample` | 6 champs | + `mainStackOrder: 1` | BF-3 |
| `api/src/application/skills/list-skills.use-case.spec.ts` | `skills` (2) | 6 champs | + `mainStackOrder` 1 et `null` | BF-3 |
| `api/src/application/skill-groups/list-skill-groups.use-case.spec.ts` | `groups[0].skills` (2) | 6 champs | + `mainStackOrder` 1 et `null` | BF-3 |
| `api/src/application/projects/list-projects.use-case.spec.ts` | `project().skills`, `skills` du test d'ordre | 6 champs | + `mainStackOrder` 1, `null` | BF-3 |
| `api/src/infrastructure/db/experiences/drizzle-experiences.repository.spec.ts` | lignes de la doublure proxy (colonnes du `select`) | `[…, 'langages', 2]` | `[…, 'langages', 1, 2, true]` (colonne `main_stack_order`, puis `experienceId` et `shown_in_stack`) | BF-3 |
| `contracts/src/openapi/__snapshots__/openapi.json` | instantané | contrat 1.0.0 du lot 14 | régénéré à chaque ticket, diff limité au ticket | BF-1 à BF-5 |
| `contracts/src/cv/cv.fixtures.ts` | `cvExample` | sans `recommendations`, `aiOverview` | + 1 recommandation (BF-4), + section IA (BF-5) | BF-4, BF-5 |
| `api/src/application/cv/get-cv.use-case.spec.ts` | `data`, `build()`, « lance les 10 cas d'usage en parallèle » | 10 dépendances | + `recommendations`, `aiOverview` ; 12 dépendances ; titre « 12 cas d'usage » | BF-4, BF-5 |
| `api/src/infrastructure/http/controllers.spec.ts` | `cv` de `CvController` | sans les deux clés | + `recommendations: []`, `aiOverview: null` | BF-4, BF-5 |
| `contracts/src/openapi/document.spec.ts` | `expectedPaths`, « déclare exactement les 13 chemins », « porte le paramètre lang sur 12 chemins » | 13 chemins, 12 avec `lang` | 15 chemins (+ `/recommendations`, `/ai-overview`), 14 avec `lang` | BF-4, BF-5 |
| `contracts/src/openapi/document.snapshot.spec.ts` | « nomme chaque opération de façon unique » | 13 `operationId` | 15 | BF-4, BF-5 |
| `api/test/matrix.e2e-spec.ts` | « couvre les 12 routes » | 12 | 14 | BF-4, BF-5 |
| `api/test/harness.e2e-spec.ts` | « ENDPOINTS décrit 12 routes distinctes… » | 12 | 14 | BF-4, BF-5 |
| `api/test/openapi-conformance.e2e-spec.ts` | « couvre les 12 routes de contenu », « … déclare 13 routes GET » | 12, 13 | 14, 15 | BF-4, BF-5 |
| `api/test/security.e2e-spec.ts` | commentaire de `ALL_PATHS` | « Les 12 routes » | « Les 14 routes » (aucune assertion changée) | BF-4, BF-5 |
| `api/test/support/endpoints.ts` | `ENDPOINTS`, `TRANSLATION_TABLES` | 12 routes, 11 tables | + `recommendations` (liste, 3 seedées), `aiOverview` (objet) ; + `recommendations_translations`, `ai_overview_translations` | BF-4, BF-5 |
| `api/test/support/fixtures.ts` | `CONTENT_TABLES` (nettoyage `qa-%`) | 10 tables | + `recommendations` | BF-4 |
| `api/test/support/empty-database.ts` | `CONTENT_TABLES` (base vide) | 11 tables | + `recommendations`, `ai_overview` | BF-4, BF-5 |

Les tests ajoutés par moi dans un commit et ajustés dans un commit suivant de la même étape (nouveaux depuis
`develop`, donc hors contrôle d'intégrité) : `experience-skills.spec.ts`, `list-experiences.shown-in-stack.spec.ts`,
`drizzle-experiences.shown-in-stack.spec.ts` (BF-2) reçoivent `mainStackOrder` en BF-3.

## Tests ajoutés

- Contrats : `profile.fields.spec.ts` (BF-1, dont 15 cas de `cvPath`), `experience-skills.spec.ts` (BF-2),
  `skills.main-stack.spec.ts` (BF-3), `recommendations.spec.ts` et `recommendations.cv.spec.ts` (BF-4),
  `ai-overview.spec.ts` et `ai-overview.cv.spec.ts` (BF-5).
- API, unitaires : `get-profile.front-fields.spec.ts`, `list-experiences.shown-in-stack.spec.ts`,
  `drizzle-experiences.shown-in-stack.spec.ts`, `list-skills.main-stack.spec.ts`, `select-published-skills.spec.ts`,
  `list-recommendations.use-case.spec.ts`, `recommendations.controller.spec.ts`, `ai-overview.use-cases.spec.ts`,
  `drizzle-ai-overview.repository.spec.ts`, `ai-overview.controller.spec.ts`.
- API, e2e : `profile-front.e2e-spec.ts` (BF-1 : textes du handoff fr/en, `cv.profile`, 8 cas de ligne `en`
  incomplète → `fr` entier, 3 cas de ligne `fr` incomplète → 404, soft delete), `experience-skills-front.e2e-spec.ts`
  (BF-2), `skills-main-stack.e2e-spec.ts` (BF-3), `social-links-front.e2e-spec.ts` (BF-6),
  `recommendations.e2e-spec.ts` (BF-4), `ai-overview.e2e-spec.ts` (BF-5). Les deux nouvelles routes entrent aussi
  dans `matrix`, `harness`, `openapi-conformance`, `security` et `empty-database` par `ENDPOINTS`.

## Mutation

- Contrats (`pnpm --filter @siteperso/contracts test:mutation`, seuil de rupture 100) : **100 %**, 513 tués,
  0 survivant, 0 sans couverture, 74 erreurs de compilation (exclues du score). Aucun équivalent déclaré.
- API (`pnpm test:mutation`, seuil de rupture 40) : premier passage après BF-5 à **40,50 %** (384 tués,
  23 timeouts, 218 survivants, 380 sans couverture), au-dessus du seuil mais sous la référence du lot 12
  (40,77 %) : les survivants nouveaux venaient surtout des schémas Drizzle de l'étape 1 (`schema/ai-overview.ts`,
  `schema/recommendations.ts`, colonnes de `schema/profile.ts`) et de quatre mutants de mes dépôts
  (`drizzle-profile.repository.ts` sans couverture unitaire, `published = true` de
  `drizzle-recommendations.repository.ts`, de `select-published-skills.ts` et de `drizzle-experiences.repository.ts`).
  Tués par quatre doublures proxy ajoutées (commit `test(api)` final) : second passage à **46,37 %** (410 tués,
  56 timeouts, 165 survivants, 374 sans couverture, 497 erreurs de compilation) ; mes dépôts et la requête de
  base des compétences à 100 %. Aucun équivalent déclaré.

## Points ouverts

1. **docs/01** (contrat d'API et tables) ne mentionne ni `/recommendations`, ni `/ai-overview`, ni les champs de
   BF-1 à BF-3 : à compléter par l'orchestrateur ou le lead-architecte (hors de mon périmètre).
2. **`packages/contracts/README.md`** dit « 13 chemins » et liste les ressources sans `recommendations` ni
   `ai-overview` : à mettre à jour (15 chemins), demande de changement partagé, je n'y ai pas touché.
3. BF-3 et `projects` : voir « Écarts ». Si Julien veut un `Skill` sans rang dans `Project`, il faudra un second
   schéma de compétence (et un second type côté Rust).
4. `Recommendation.locale` référence le composant `Locale`, dont la description générique parle du paramètre
   `lang` ; le sens propre (« langue de la ligne servie ») est dans la description de `Recommendation`. Un
   `$ref` ne peut pas porter sa propre description sans `allOf` dans ce générateur.
5. docs/04 parle encore d'un état vide des recommandations (`published = false`) : obsolète depuis la décision de
   Julien du 19 nov. (étape 1).

## Ce que l'étape 3 doit savoir

1. `drizzle-profile.repository.ts` : quand les neuf colonnes passeront `not null`, le helper `present()` devient
   inutile (les types de `translated` seront non nuls) ; à retirer. La condition `isComplete` des jointures peut
   rester (défense en profondeur, doublon des `check`) ou être retirée : dans les deux cas, le comportement servi
   ne change pas.
2. **Tests e2e que les contraintes de l'étape 3 rendront impossibles à préparer** (autorisation à reconduire) :
   `apps/api/test/profile-front.e2e-spec.ts`, blocs « ligne en incomplète » (8 cas : `null`, `''`, `taglines`
   nulles, vides, avec un élément vide ou nul) et « ligne fr incomplète » (3 cas) : leurs `update` seront refusés
   par `not null` et les `check`. À remplacer par la vérification que la base les refuse (le comportement servi
   devient garanti par le schéma) ; le cas « profil marqué deleted_at » reste valide.
3. Rien d'autre côté API ne lit `headline`, `bio`, `availability` : leur suppression ne touche que le schéma
   Drizzle `profile.ts`, le seed et les tests de base listés par l'étape 1.
4. Les autres colonnes et tables (BF-2 à BF-5) sont déjà dans leur état final, côté base comme côté API.

## Vérifications

- `pnpm check` vert avant chaque commit de ticket (garde-fous, intégrité, lint, typecheck, unitaires, e2e,
  couverture fusionnée à 100 %).
- `pnpm check` final (117a0ad) : vert. Contrats 220 tests ; API 432 unitaires, 705 e2e (605 avant l'étape) ;
  couverture fusionnée **100 %** sur les quatre métriques : API instructions 770/770, branches 232/232,
  fonctions 279/279, lignes 749/749 ; contrats 59/59, 2/2, 9/9, 56/56.
- `pnpm integrity develop` : OK.
- Mutation : contrats 100 % (seuil 100), API 46,37 % (seuil 40), détail plus haut.
- `pnpm db:down` lancé en fin d'étape ; aucun bac à sable `.stryker-tmp*` restant (Stryker les supprime après un
  passage réussi, vérifié).
- Fichiers touchés hors dossiers des ressources : uniquement ceux autorisés pour ce lot (`app.module.ts`,
  `packages/contracts/src/index.ts`, `openapi/document.ts`, `cv/cv.fixtures.ts`, `apps/api/test/support/`), plus
  `infrastructure/db/skills/select-published-skills.ts` (requête de base de la ressource `skills`). Aucun fichier
  source de `projects` modifié.
