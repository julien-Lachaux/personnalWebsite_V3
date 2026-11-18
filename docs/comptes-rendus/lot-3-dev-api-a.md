# Lot 3 : Dev API A

Branche `lot/3-api-a` (dérivée de `v3/backend`, lots 0, 1, 2 et 5 fusionnés). Périmètre tenu :
uniquement les dossiers `profile`, `social-links`, `skills`, `skill-groups`, `experiences` et
`languages` des couches domaine, application, `infrastructure/db`, `infrastructure/http`, leurs
e2e `apps/api/test/<resource>.e2e-spec.ts`, et ce compte rendu (`git diff --name-only
v3/backend..HEAD` ne sort aucun autre fichier). Un commit atomique par ticket (L3-01 à L3-06) plus
ce compte rendu (L3-14).

## Fait

- L3-01 `profile` : `GetProfileUseCase`, 404 problem+json (`EntityNotFoundError`) si la ligne
  manque. `curl /api/v1/profile | grep -ciE "@|tel"` = 0 (vérifié sur la base de dev).
- L3-02 `social-links` : `ListSocialLinksUseCase`, `published` seulement, tri `sort_order, id`.
- L3-03 `skills` : `ListSkillsUseCase`, 34 compétences sur la base seedée, `groupSlug` renseigné.
- L3-04 `skill-groups` : `ListSkillGroupsUseCase`, 7 groupes avec compétences imbriquées en deux
  requêtes ; test unitaire du dépôt qui compte les requêtes (client Drizzle de doublure).
- L3-05 `experiences` : `ListExperiencesUseCase`, 8 expériences, `date_start desc`, compétences par
  `experience_skills.sort_order`, dates `YYYY-MM-DD`, `logo` null sans chemin, pause sans société
  avec `stackLabel` « Huile de coude » (« Elbow grease » en `en`).
- L3-06 `languages` : `ListLanguagesUseCase`, `cefrLevel` C1 pour l'anglais et null pour le français.
- Chaque module exporte son cas d'usage (`exports: [...]`) sous le nom de classe fixé au backlog.
- Chaque controller parse `?lang` avec `LocaleQuerySchema.safeParse(request.query)` (400
  problem+json sinon) et valide la réponse avec le schéma strict du contrat avant envoi.
- Tests : unitaires de chaque cas d'usage (dépôt en mémoire), deux tests de dépôt à doublure
  `drizzle-orm/pg-proxy` (skill-groups, experiences), un e2e par ressource : fr, en, repli en vers fr
  (suppression des lignes `en` puis `resetTestDatabase()` en `afterAll`), `?lang=de` en 400, forme
  validée par le contrat, filtrage `published`, tri.
- Vérifié : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts ; tous les e2e verts sauf
  les 6 cas de `test/errors.e2e-spec.ts` (voir « Changements partagés »).

## Non fait

- Rien du périmètre. `errors.e2e-spec.ts` n'a pas été modifié (fichier partagé, hors périmètre).

## Décisions prises

1. **Requête partagée `selectPublishedSkills`** (`infrastructure/db/skills/select-published-skills.ts`) :
   base de requête des dépôts `skills`, `skill-groups` et `experiences` (compétence publiée, groupe
   publié, nom traduit en SQL), pour ne pas dupliquer la logique de repli. Elle accepte des colonnes
   supplémentaires et une condition. Elle vit dans le dossier `db/skills/` du périmètre.
2. **Compétence d'un groupe non publié** : exclue partout (`/skills`, `/skill-groups`, compétences
   d'une expérience). Sans cela `groupSlug` pointerait vers un groupe absent de `/skill-groups`.
3. **Tri de `/skills`** : ordre du groupe, puis `sort_order` de la compétence, puis `id`. Le
   `sort_order` des compétences est par groupe dans le seed (1, 2, 3 dans chaque groupe) : un tri
   sur `sort_order` seul mélangerait les groupes. Même ordre que les compétences imbriquées.
4. **`skill_groups_translations.description` est nullable** (null dans tout le seed) alors que le
   contrat exige une chaîne : `coalesce(en, fr, '')`, donc chaîne vide.
5. **Logo d'expérience** : `{ path, alt }` seulement si `logo_path` ET `logo_alt` sont présents,
   sinon `null` (une image sans texte alternatif n'est pas exposée, docs/01). Le contrat refuse un
   `alt` vide : évite un 500 sur une donnée incomplète.
6. **Repli de langue champ par champ** (`coalesce(en.col, fr.col)`), y compris pour `achievements`
   (`text[]`) : une ligne `en` avec un tableau vide donne un tableau vide, pas le français. Les
   champs nullables (`location`, `stackLabel`, `logoAlt`) retombent sur le français si l'anglais est
   null.
7. **`skill-groups` et `experiences` : deux requêtes** (parents, puis enfants de tous les parents),
   la seconde est sautée s'il n'y a aucun parent (experiences). Dans `skill-groups` elles partent
   en parallèle (`Promise.all`), car la seconde ne dépend pas de la première.
8. **Domaine sans import des contrats** : types miroirs (`ExperienceKind`, `ContractType`,
   `WorkMode`, `CefrLevel` en unions littérales) ; la correspondance avec les types du contrat est
   faite dans les cas d'usage. `languages.cefrLevel` est casté dans le dépôt (colonne `text`, valeurs
   garanties par la contrainte SQL `cefr_level`).
9. **Test de comptage de requêtes** : un `drizzle` branché sur `drizzle-orm/pg-proxy` (aucune base,
   donc tests unitaires sans réseau) avec un logger de requêtes, glissé dans un
   `DrizzleDatabaseClient` de doublure (`as unknown as`).
10. Le helper `translated` (`coalesce`) est dupliqué dans chaque dépôt (une ligne) : un helper
    commun exigerait un fichier hors périmètre (`infrastructure/db/` racine).

## Changements partagés demandés à l'orchestrateur

- **`apps/api/test/errors.e2e-spec.ts`** : la liste `PENDING_RESOURCES` contient encore `profile`,
  `social-links`, `skill-groups`, `skills`, `experiences` et `languages` et attend un 501 : les 6
  cas échouent maintenant que ces routes répondent 200. Retirer ces six entrées (et celles de
  l'agent B quand il livre ; la liste peut finir vide, alors supprimer le test `it.each` ou le
  remplacer par un cas qui ne dépend d'aucune ressource). Ce fichier n'est dans aucun périmètre de
  ressource, je ne l'ai pas modifié.
- Aucun export, colonne ni contrat à ajouter : `index.ts` des contrats exporte déjà tous les
  schémas utilisés, `app.module.ts` enregistre déjà les six modules.

## Points ouverts

- `skill_groups_translations.description` nullable en base mais requise (chaîne) dans le contrat :
  si Julien veut distinguer « pas de description », passer `description` en `nullable` dans
  `SkillGroupSchema` (lot contrats) ; sinon le contrat actuel est respecté avec `''`.
- Le helper `translated` (repli de langue) pourrait être factorisé dans un fichier commun de
  `infrastructure/db/` ; l'agent B a probablement les mêmes besoins.
- Cas d'usage fixé « `ListSkillGroupsUseCase` » et `ListSkillsUseCase` : `cv` doit utiliser
  `ListSkillGroupsUseCase` (compétences imbriquées) ; `CvSchema` ne répète pas les compétences à plat.
- Les liens `github` et `website` manquent toujours dans le seed (P1 du lot 1) : `/social-links`
  ne renvoie que LinkedIn.
- Les noms de compétences et de groupes anglais sont ceux du seed (marqués « à relire » dans
  `docs/traductions-a-relire.md`) ; l'e2e vérifie seulement leur présence et quelques valeurs
  (« Languages and frameworks », « Elbow grease »). Si Julien corrige ces traductions, ajuster les
  deux assertions correspondantes.
