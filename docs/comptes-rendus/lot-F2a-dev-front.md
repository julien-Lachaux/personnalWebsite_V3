# Lot F2a : logique pure du filtre et formatage (dev-front)

Date : 20 novembre 2026. Branche `lot/F2a-filtre` (worktree `.claude/worktrees/lot-F2a-filtre`), depuis
`develop` (b5bf2e4). Isolation : `COMPOSE_PROJECT_NAME=siteperso-v3-f2a`, ports 5862 à 5865.
Périmètre écrit : `apps/web/app/domain/{filter,format}.ts` et leurs `*.spec.ts`, ce compte rendu.

## Fait

| Ticket | Livré | Preuve |
|---|---|---|
| F2-01 `filter` | `app/domain/filter.ts` : correspondance techno ↔ XP (puces + mots-clés cachés, par slug), filtre ET strict en groupes `full` / `partial` / `none` (ordre d'origine, technos correspondantes), compteurs et états par techno, stack principale triée, suggestions, première suggestion valide, ajout / retrait / bascule idempotents, lecture et écriture de `?tech=`, données d'annonce `aria-live` | `filter.spec.ts` : cas du handoff (huit XP, `php` relié à quatre XP, `typescript` + `php` = 0, `ocr` et `rest-api` cachés) |
| F2-05 `format` | `app/domain/format.ts` : période (`Intl.DateTimeFormat`, `fr` et `en`, en cours si `dateEnd` nul), ligne « lieu, mode · contrat », date de recommandation | `format.spec.ts` ; aussi vert sous `TZ=Pacific/Honolulu` (dates lues en UTC) |

Vérifications : `pnpm --filter @siteperso/web test:coverage` 100 % (89/89 instructions, 51/51 branches,
44/44 fonctions, 70/70 lignes) ; `lint` et `typecheck` verts ; mutation : voir ci-dessous.

### Mutation (réserve R1 de la recette F0)

`pnpm --filter @siteperso/web test:mutation` mute bien les fichiers (premier vrai passage du front) :

```
File       |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
All files  | 100.00 |  100.00 |      206 |         0 |          0 |        0 |        0 |
 filter.ts | 100.00 |  100.00 |      152 |         0 |          0 |        0 |        0 |
 format.ts | 100.00 |  100.00 |       54 |         0 |          0 |        0 |        0 |
```

Premier passage : 99,04 %, deux mutants survivants dans `parseTechParam` (`?? []` et `?? ''`
remplacés par une valeur factice : équivalents, car un slug factice est de toute façon inconnu).
Corrigé par la forme du code (filtre `typeof part === 'string'` à la place des `??`), pas par une
directive : aucun équivalent déclaré, aucune directive `Stryker disable`. Les tests de
`architecture.spec.ts` apparaissent « covered 0 » dans la sortie (ils ne touchent aucun fichier
muté) : sans effet sur le score.

## API publique

Types d'entrée propres au domaine (indépendants de Vue, Nuxt et Zod ; le mapping contrat → domaine
viendra en F4) :

- `FilterTech { slug, name, groupSlug, mainStackOrder: number | null }` ;
- `FilterExperience { slug, visibleSlugs, hiddenSlugs }` (technos en puces et mots-clés cachés).
  Les fonctions sont génériques sur `E extends FilterExperience` : le composant peut fournir son type
  de carte, il le retrouve dans `entry.experience`.

`app/domain/filter.ts` (l'état du filtre est la liste ordonnée des slugs choisis) :

- `hasTech(experience, slug)`, `experiencesWithAll(experiences, slugs)` (ET ; toutes si liste vide) ;
- `filterExperiences(experiences, selected)` → `{ active, full, partial, none }`, chaque groupe étant
  une liste de `{ experience, matched }` (`matched` = technos choisies que porte l'expérience, dans
  l'ordre du filtre). Sans filtre : tout dans `full`, `active = false`. « Voir les N autres » =
  `partial.length + none.length` ; le message « aucune ne combine toutes ces technos » = `active` et
  `full` vide ; le « En partie : X » d'une carte repliée = `matched` d'une entrée de `partial` ;
- `techCounter(experiences, selected, slug)` et `techCounters(techs, experiences, selected)` →
  `{ slug, state, count, total, selectable }` avec `state` ∈ `selected` | `available` | `disabled` |
  `unlinked`. `count` = XP restantes si on ajoute la techno, résultat courant si elle est choisie, 0
  sinon ; `total` = XP qui la portent hors filtre ; `selectable` = un clic a un effet (`disabled` et
  `unlinked` : `aria-disabled`, le second en pointillé) ;
- `mainStack(techs)` : technos avec rang, triées par `mainStackOrder` ;
- `normalizeQuery(text)`, `suggest(query, techs, experiences, selected, limit = MAX_SUGGESTIONS)` →
  `Suggestion[]` (compteur + `tech`), `MAX_SUGGESTIONS = 6`, `firstValidSuggestion(suggestions)`
  (Entrée) ;
- `addTech`, `removeTech`, `toggleTech`, `removeLastTech` (Retour arrière sur champ vide) : idempotents,
  même tableau rendu quand rien ne change ;
- `parseTechParam(value, knownSlugs)` (chaîne, paramètre répété, `null`, `undefined`) et
  `serializeTechParam(selected)` (`undefined` si vide, pour retirer le paramètre) ;
- `announceResults(experiences, selected)` → `{ kind: 'all' | 'results' | 'empty', count, others,
  filters }` : l'interface compose la phrase (pluriels) avec son i18n.

`app/domain/format.ts` :

- `type Locale = 'fr' | 'en'` ;
- `formatPeriod(dateStart, dateEnd, locale, presentLabel)` : « janv. 2026 – mai 2026 » (fr),
  « Jan 2026 – May 2026 » (en) ; `dateEnd` nul → `presentLabel` injecté ;
- `formatExperienceMeta({ location, workMode, contractType }, { workMode(v), contractType(v) })` :
  « Paris, hybride · CDI » ; `none`, valeurs nulles ou blanches omis sans séparateur orphelin, texte
  vide si tout manque (la carte masque alors la ligne) ;
- `formatRecommendationDate(date, locale)` : « 8 décembre 2025 », « December 8, 2025 ».

## Décisions

- **Types dans `filter.ts` et `format.ts`**, pas de `types.ts` : le lot F2b travaille en parallèle dans
  le même dossier, un fichier commun aurait été un point de conflit.
- **Recherche des suggestions sur le nom** de la techno (sans casse ni accents, NFD), pas sur le slug.
  Écart voulu avec la maquette (qui ne gère que la casse), demandé par le ticket.
- **Tri des suggestions** : `total` décroissant (XP liées, comme `countOf` de la maquette), puis rang
  de stack principale (`mainStackOrder`, sans rang après tous les autres), puis ordre d'origine (tri
  stable). Le « rang » de la maquette (`ORDER`) est la stack principale ; ici elle vient de l'API.
- **Techno sans XP** : `unlinked`, non sélectionnable ; une techno choisie reste sélectionnable
  (retirable) même quand le filtre ne donne plus rien.
- **Groupes de résultats** : la maquette ne remplit jamais « en partie » (tout le reste est replié) ;
  la SPEC (« En partie : X » pour les correspondances partielles) et le ticket donnent trois groupes,
  retenus. La SPEC gagne.
- **Dates lues en UTC** (`timeZone: 'UTC'`, entrée `AAAA-MM-JJ`) : pas de glissement de mois selon le
  fuseau de la machine de build.
- **Lecture de l'URL** : les slugs sont comparés tels quels (minuscules), les espaces de bord retirés.
  Une date invalide fait lever `RangeError` à `Intl` (les contrats garantissent des dates ISO).

## Non fait

Rien du périmètre. Le composable `?tech=` (lecture et écriture réelles de l'URL avec vue-router), les
libellés d'annonce et le mapping contrat → domaine relèvent de F3 et F4.

## Points ouverts

- Les libellés FR et EN de la ligne de métadonnées (`hybride`, `CDI`…), de « aujourd'hui / present »
  et de l'annonce `aria-live` sont à créer par l'agent de la section expériences (fichiers
  `i18n/locales/{fr,en}/experience.json`) ; le domaine n'en porte aucun.
- Le mot-clé caché `searchKeywords` de la SPEC est, côté API, un lien `shownInStack = false` : le
  mapping F4 doit remplir `hiddenSlugs` avec ces slugs et `visibleSlugs` avec ceux de `shownInStack = true`.
- Demande de changement partagé : aucune.
