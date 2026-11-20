# Lot F1 bis : ajustements partagés du front et cache Turborepo (lead-architecte)

Date : 20 novembre 2026. Branche `lot/F1bis-ajustements` (worktree
`.claude/worktrees/lot-F1bis-ajustements`), créée depuis `develop` (961a2e6). Isolation : `.env`
racine `siteperso-v3-f1bis`, 5882/5883, `PLAYWRIGHT_PORT=5884`, `WEB_E2E_PORT=5885`. Autorisation
**49daa543** utilisée pour `turbo.json` seul (deux commits, `Justification-test: F1bis …`) ;
`apps/web/turbo.json` n'a pas été créé. Rien de modifié dans `apps/api`, `db`, `packages/contracts`,
`app/components/shell/`, `app/composables/shell/`, `app/data/`. Journaux dans le dossier temporaire
de session, préfixés `f1bis-`.

## D13 : cache Turborepo partagé entre worktrees

### Cause

1. **Partage voulu par Turborepo 2.x.** Sans `cacheDir` explicite, un worktree lié utilise le cache
   local du checkout principal (documentation « Caching », section worktrees : « Turborepo
   automatically shares the local filesystem cache between the main worktree and any linked
   worktrees » ; « If you set an explicit `cacheDir` […] worktree cache sharing is disabled »).
   Preuves : aucun worktree n'avait de `.turbo/cache` ; le checkout principal en avait 717 artefacts,
   écrits par F0, F1, F2a, F2b, F3b et la session principale ; les journaux de `turbo run` disent
   « Remote caching disabled, using shared worktree cache ». Un « cache hit » rejoue alors le
   journal du worktree qui a produit l'artefact, avec ses chemins absolus, et restaure ses sorties
   (`dist/**` des contrats) ; rien ne prouve que la tâche a tourné sur la branche du lot.
2. **Fichiers lus hors des entrées.** L'empreinte d'une tâche ne contient que les fichiers suivis du
   paquet, la racine `package.json` et le lockfile. Or `eslint.config.js` (importé par les trois
   ESLint), `tsconfig.base.json` (étendu par l'API et les contrats), `.npmrc` (version de Node) et
   `pnpm-workspace.yaml` sont lus par des tâches en cache, et `apps/web/.env.test` (ignoré par git)
   est lu par @nuxt/test-utils (`setupDotenv`, `fileName: ".env.test"`). Les modifier n'invalidait
   rien : un lot qui touche la configuration ESLint racine voyait son lint rejoué d'avant.
3. **Pas de collision d'empreinte.** Je n'ai pas pu reproduire « contenu différent, même empreinte » :
   un fichier suivi modifié, un fichier non suivi ajouté, deux worktrees au contenu différent donnent
   des empreintes différentes, et chaque artefact du cache principal correspond au contenu du
   worktree qui l'a produit (journaux décompressés, `scan`). Le constat de la recette F2a
   (`layout.spec.ts` puis `tokens.spec.ts` dans un `check` de F2a) s'explique au plus probable par un
   journal de commande au nom générique partagé : `check.log` du dossier temporaire de session a été
   écrit à 05:30:56 par le `pnpm check` de **F2b** (`> siteperso-v3@0.0.0 check …/lot-F2b-tuiles`,
   conteneurs `siteperso-v3-f2b`), pendant la recette de F2a. C'est une inférence : le journal de la
   recette F2a n'existe plus. D'où la règle des noms de journaux par lot (CLAUDE.md).

### Démonstration avant / après

| Étape | Commande | Avant (develop 961a2e6) | Après (b98d5e0) |
|---|---|---|---|
| Worktree neuf, même contenu que develop | `turbo run test --filter=@siteperso/web` dans un worktree détaché du dossier temporaire | « using shared worktree cache », `web:test: cache hit, replaying logs a66187bdcb88d834`, journal `> … test …/worktrees/lot-F1-design-system/apps/web`, aucun test exécuté ici (`f1bis-avant-wta.log`) | « Remote caching disabled » seul, `cache miss, executing 704d2a00eb12760e`, 21 fichiers de test exécutés dans `wt-a/apps/web` (`f1bis-apres-wta-1.log`) |
| Second worktree, contenu identique | idem dans `wt-b` | (partagé) | `cache miss, executing 704d2a00eb12760e` : même empreinte, aucun partage ni avec `wt-a` ni avec le worktree du lot qui l'avait déjà (`f1bis-apres-wtb-1.log`) ; second passage `cache hit` de son propre cache, journal de `wt-b` (`f1bis-apres-wtb-2.log`) |
| Fichier de `apps/web/app` modifié | `app.vue` + commentaire, puis `turbo run test` | empreinte a66187… → c26edb2c… (`--dry=json`) | `cache miss, executing 6c3da8b47c2dcf04` (`f1bis-apres-wta-2.log`) |
| Fichiers racine modifiés | `eslint.config.js`, `tsconfig.base.json`, `.npmrc`, puis `turbo run lint typecheck test --dry=json`, comparaison | les 10 empreintes **inchangées** | les 10 empreintes changent (`f1bis-root-before.json`, `f1bis-root-after.json`) |
| Cache principal | artefacts récents de `personnalWebsite_V3/.turbo/cache`, journal décompressé | — | seuls F3b (encore sur l'ancienne configuration) et la session principale y écrivent ; aucun artefact des worktrees du correctif, qui ont chacun le leur (9 et 6 artefacts) |

### Correctif (`turbo.json`)

- `cacheDir: ".turbo/cache"` : relatif, résolu depuis la racine de chaque worktree (documentation),
  donc un cache par worktree, déjà ignoré par git (`.turbo/`).
- `globalDependencies` : `tsconfig.base.json`, `eslint.config.js`, `.npmrc`, `pnpm-workspace.yaml`.
- `@siteperso/web#test` : `inputs: ["$TURBO_DEFAULT$", ".env.test"]`.
- `@siteperso/web#test:e2e` : `dependsOn` ajoute `lint`, `typecheck`, `test` du même paquet (voir
  ci-dessous).

Aucune tâche retirée de `pnpm check`, aucune sortie ignorée, `test:e2e`, `test:coverage` et
`test:mutation` restent hors cache.

**Course révélée par le correctif.** Le premier `TURBO_FORCE=true pnpm check` après le changement a
échoué : six fichiers de test du front en « Failed to resolve import "#app-manifest" ».
`web:test:e2e` lance `nuxt generate`, qui régénère `apps/web/.nuxt/` (« Generating types ») à
l'instant où l'environnement Nuxt de Vitest le lit (journal `f1bis-check-force.log` de la première
passe, lignes 904-906). Tant que `web:test`, `web:lint` et `web:typecheck` étaient rejoués depuis le
cache partagé, ils ne tournaient presque jamais en même temps que la génération. Les parcours
Playwright du front attendent désormais ces trois tâches (commit d5be36c).

## D12 : bordure des contrôles

`app/assets/css/control-tokens.css` (nouveau, chargé après `tokens.css`) : `--line-control`
`#66798a` en sombre, posé ou système ; `var(--line)` ailleurs ; `--border-control` = bordure
complète. `tokens.css` n'est pas touché : son test de fidélité au handoff ne bouge pas (les blocs
de thème y sont comparés en entier au JSON du handoff, une variable de plus y casserait l'égalité,
d'où le fichier séparé).

| Palette | `--line-control` | bg | card | top | bar | field |
|---|---|---|---|---|---|---|
| sombre | #66798a | 3,92 | 3,52 | 3,27 | 3,21 | 3,92 |
| sombre (`--line` décoratif, inchangé) | #3a4b57 | 1,95 | 1,75 | 1,63 | 1,60 | 1,95 |
| clair | #14262b (`line`) | 12,95 | 15,65 | 14,36 | 10,76 | 15,65 |
| sombre renforcé | #a9bcc7 (`line`) | ≥ 6,9 partout | | | | |
| clair renforcé | #000000 (`line`) | ≥ 14,4 partout | | | | |

Éléments de base modifiés : contour de `TechChip` cliquable, piste de `Switch`, segments de
`SegmentedControl`, `Button`/`LinkButton` `secondary` (`button.css`), cadre de `Popover` (panneau
superposé au contenu, sa limite le sépare de ce qu'il recouvre). Inchangés, avec le motif :
`outline` (bordure `--text`, déjà 12:1 et plus), cadre de `Window` (`--accent`, déjà ≥ 3:1), cadre
de `Tile` (région de mise en page, pas un contrôle ; ses boutons sont identifiés par leur icône et le
focus), séparateurs des barres de titre et du bouton ×, puce pointillé non interactive (garde
`--line`, explicitement).

Tests ajoutés : `app/assets/css/control-tokens.spec.ts` (cascade de la racine calculée depuis la CSS
livrée, sept états : sombre posé, sombre système, clair posé, clair système, deux renforcés,
renforcé sans thème ; témoins de la cascade et du calcul ; sensibilité vérifiée : `#55687a` échoue à
2,75/2,56/2,51), `app/components/base/control-borders.spec.ts` (déclarations des styles livrés),
et dans le navigateur la couleur calculée des contours (`controls.e2e.ts`).

## D17 : puces de techno

`TechChip` ne prend plus 44 px sous 1024 px : hauteur naturelle de la maquette à toutes les largeurs
(remplissage 4 px, interligne 1,3 × 14 px, bordure 1,5 px : 29,2 px ; 40 px pour `md`). Ajout de
`min-width` et `min-height` à `--target-min` (24px, en px car 2.5.8 se mesure en px CSS) : avant,
une puce d'une seule lettre étroite (« I ») faisait **22 px** de large (mesuré, l'ancien style fait
échouer le nouveau parcours sur les sept tailles, `f1bis-controls-e2e-avant.log`).

Parcours `apps/web/test/controls.e2e.ts` (nouveau, 9 tests × 7 tailles = 63) : style livré du
composant ajouté à la page générée, puces collées sans espace (`gap: 0`), boîtes mesurées ;
critère 2.5.8 complet, exception d'espacement comprise (cercle de 24 px), avec quatre témoins ;
24 ≤ hauteur < 32 ; texte à 130 %, police lisible, espacement augmenté ; `md` à 40 px ; contours
D12 en sombre, clair, sombre renforcé.

## Clés communes

`i18n/locales/{fr,en}/common.json`, espace `common` : `close` (Fermer / Close), `opensInNewTab`
(s'ouvre dans un nouvel onglet / opens in a new tab), `expand` (Agrandir {name} / Expand {name}),
`collapse` (Réduire {name} / Collapse {name}), `showDetails` (Voir le détail : {name} / Show
details: {name}). Test `app/i18n-common.spec.ts` (rendu dans les deux langues, `{name}` remplacé) ;
`i18n-messages.spec.ts` vérifie les mêmes clés en fr et en.

## Décisions

- **Cache par worktree plutôt que des `inputs` plus fins seuls** : le partage est un choix par défaut
  de Turborepo, pas un défaut d'empreinte ; seul `cacheDir` le coupe. Alternative écartée : garder le
  partage (correct par contenu) en complétant l'empreinte : les journaux rejoués citeraient toujours
  un autre worktree et une recette ne prouverait rien sans `--force`. Coût : un premier `check` à
  froid par worktree.
- **`globalDependencies` plutôt que `$TURBO_ROOT$` dans les `inputs` de chaque tâche** : un fichier
  racine lu par une tâche invalide tout, plus simple à tenir ; l'invalidation en trop est rare
  (fichiers peu modifiés).
- **`control-tokens.css` séparé** plutôt qu'ajouter `--line-control` dans `tokens.css` : `tokens.css`
  reste le handoff à l'identique et son test ne bouge pas.
- **`--target-min` en px** (exception à « tout en rem ») : 2.5.8 se mesure en px CSS, une taille en
  rem diminuerait avec une taille de navigateur réduite.
- **« Voir le détail : {name} »** plutôt que « de {name} » proposé par F1b : pas d'élision à gérer
  (« de Orange »).
- **Ordre `web:test:e2e` après `lint`, `typecheck`, `test`** plutôt qu'un `.nuxt` séparé pour
  `nuxt generate` : une ligne de configuration, aucun changement de Nuxt.

## Vérifications

- `pnpm format` : code 0, aucun fichier modifié.
- `TURBO_FORCE=true pnpm check` sur conteneurs neufs (`docker compose down -v` avant), après le
  commit d5be36c : code 0 (`f1bis-check-force.log`). Hooks 549/549, intégrité OK, 12 tâches
  exécutées sur 12 (0 en cache) : unitaires contrats 220, API 430, front 353 ; e2e API 753,
  Playwright front 252 (189 + 63 de `controls.e2e.ts`) ; puis 4 tâches de couverture, 100 % partout
  (API 765/232/276/745, contrats 59/2/9/56, front 406/249/108/358).
- `pnpm check` sans forcer, sur conteneurs neufs : code 0 (`f1bis-check.log`). 10 tâches en cache
  sur 12 (lint, typecheck, test des trois paquets et build des contrats), **toutes rejouées depuis
  des journaux de ce worktree** (`> … lot-F1bis-ajustements/…`) ; `api:test:e2e`, `web:test:e2e` et
  les couvertures exécutées (hors cache), mêmes nombres de tests.
- `pnpm integrity develop` : « HEAD comparé à develop (point de divergence 961a2e6e3d71) »,
  « Intégrité des tests : OK ».
- `pnpm hooks:test` : 549 tests, 549 réussis.
- `pnpm db:down` : conteneurs `siteperso-v3-f1bis` arrêtés.

## Points ouverts

1. **Cache du checkout principal** : `personnalWebsite_V3/.turbo/cache` garde ~730 artefacts écrits
   par tous les worktrees. Après fusion, les nouvelles empreintes (`globalDependencies` change
   l'empreinte globale) ne les retrouveront plus ; F3b et F4, créés avant, partagent encore ce cache
   tant qu'ils n'ont pas fusionné `develop`. Proposition : vider ce dossier (ignoré par git) une fois
   les lots en cours fusionnés.
2. **Agents protégés** : `.claude/agents/dev-front.md` (l. 50) et `revue-a11y.md` (l. 47) disent
   « cibles de 44 px sur mobile et tablette » sans l'exception D17 des puces ; à mettre à jour par
   l'orchestrateur (chemin protégé, hors autorisation).
3. **Néon au survol de la puce pointillé** : `.tech-chip:not([aria-disabled='true']):hover` s'applique
   aussi au `<span>` pointillé non cliquable (lot F1b) ; un effet de survol sur un élément non
   interactif. Correction proposée : `:not(.tech-chip--dashed)`. Non faite : hors des tickets.
4. **Hauteur des puces** : 29,2 px mesurés pour « environ 28 px » de la maquette (interligne 1,3 de
   F1b contre `normal` dans la maquette). Le test borne à 24 ≤ h < 32. Une valeur exacte de 28 px
   demanderait de changer l'interligne, aussi sur desktop.
5. **Écritures de `.nuxt/` par Vitest** pendant que `vue-tsc` et ESLint le lisent
   (`turbo run lint typecheck test`, hook pre-commit) : non observé dans sept pre-commits et deux
   `check`, à surveiller ; même remède si cela arrive (ordonner).
