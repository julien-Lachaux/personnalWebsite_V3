# Lot F6 : mosaïque des tuiles sur portable et desktop (lead-architecte)

Date : 21 novembre 2026. Branche `lot/F6-mosaique` (worktree `.claude/worktrees/lot-F6-mosaique`), depuis
`develop` (44bf925). Isolation : `.env` racine `siteperso-v3-f6`, 5962/5963, `PLAYWRIGHT_PORT=5964`,
`WEB_E2E_PORT=5965`, `TEST_MAX_WORKERS=4`. Règle D26 : ni `pnpm check` ni mutation complète. Autorisation
**b34bc53d** utilisée pour `apps/web/vitest.config.ts` seulement. Rien dans `apps/api`, `db`,
`packages/contracts`, `nuxt.config.ts`, `pages/` ni dans les fichiers du lot F7. Aucun fichier de `domain/`
touché (pas de mutation à lancer). Journaux : dossier temporaire de la session, préfixe `f6-`.

## Résumé

La mosaïque est écrite et vérifiée (unitaires 100 %, nouveau parcours 168/168 aux 7 tailles avec le correctif
ci-dessous, `shell`/`sections`/`experience` 697/707, les 10 échecs étant un test devenu obsolète). **Un seul
commit est fait (TEST_MAX_WORKERS) ; le reste est dans l'arbre de travail, non commité**, à cause d'un
blocage des garde-fous (point ouvert 1) : après la pause demandée par l'orchestrateur, mes nouveaux fichiers
de test non suivis sont devenus des « tests existants » pour les hooks, et le nouveau parcours
`test/mosaic.e2e.ts` contient 2 erreurs de type et 3 assertions fausses que je ne peux plus corriger. Tant
qu'il est sur le disque, `eslint .` et `vue-tsc` échouent et le hook pre-commit refuse tout commit.

## Fait

| Ticket | Livré | Où (état) |
|---|---|---|
| Charge | `TEST_MAX_WORKERS` lu par `apps/web/vitest.config.ts` (environnement, puis la seule clé du `.env` racine par `parseEnv`), posé sur les projets `unit` et `nuxt` : à la racine il était ignoré (15 processus pour 15 fichiers, mesuré par `ps`), par projet 4 ; valeur invalide → arrêt avec message. CLAUDE.md et `.env.example` à jour | **commit 0f8599d** (`Justification-test: F6 …`) |
| F6-01 TileGrid | `components/shell/TileGrid.vue` : 4 `BaseTile` (`profil.cv`, `experience.log`, `recommandations.md`, `ia.md`, nom = `shell.headings`, boutons « Agrandir/Réduire … » de `common.expand/collapse`) placées en absolu selon `computeLayout` ; zone = racine en `inset: 0` du `<main>` (toute la largeur, hauteur réelle sous la barre du haut, qui peut passer à la ligne), suivie par `ResizeObserver` ; tuiles sorties `pushedOut` (`inert` + `aria-hidden`) ; tuile agrandie au-dessus, bordure accent (captures) | non commité ; `TileGrid.spec.ts` (18) |
| F6-01 état | `composables/shell/useMosaic.ts` : mesures injectées, cache par (tuile, largeur), **prémesure des 5 états** (mosaïque + chaque tuile agrandie) et de S du Profil dans chacun, à chaque nouvelle zone ou mesure : un agrandissement trouve tout en cache, aucune mesure ni recalcul pendant ou après l'animation ; le rendu ne mesure jamais ; signature des valeurs : une remesure qui ne change rien ne touche à rien | non commité ; `useMosaic.spec.ts` (19) |
| F6-01 coquille | `AppShell.vue` : `TileGrid` en mode `mosaic`, chaque contenu dans un `div#section-<id>` (cible du focus, `h2` masqué visuellement, slot) ; bouton de tuile = bascule (focus gardé sur le bouton, agrandie comme réduite) ; onglet de la barre du haut = agrandit et met le focus sur `#section-<id>` (`preventScroll`) ; vue d'ensemble = mosaïque ; page sans défilement (`100dvh`, `overflow: hidden`). Avant le montage : grille simple qui défile (sans JavaScript aussi). Règle provisoire `--self-scrolling` du bureau (F5c) retirée ; double marge réglée (contenu XP sans marge, celle de la section seule) | non commité ; `AppShell-mosaic.spec.ts` (5), tests existants d'`AppShell` verts |
| F6-02 mesures | Clone hors écran du contenu de la tuile (identifiants retirés, `visibility: hidden`, `left: -99999px`, sans transformation), posé dans la racine pour hériter des styles, retiré aussitôt ; nouvelle mesure : contenu qui change de hauteur à largeur égale (`ResizeObserver` ; un changement de largeur vient de l'animation et ne relance rien), réglages `data-text-size`/`data-font`/`data-spacing` de `<html>` (`MutationObserver`), `document.fonts.ready` | non commité |
| F6-02 animation | `left/top/width/height` de la tuile et `width/transform` du contenu du Profil en `--dur-tile` / `--ease-tile` ; tuile sortie : `visibility: hidden` différée de `--dur-tile` ; `instant` coupe les transitions deux images après tout changement qui n'est pas un agrandissement (premier placement, redimensionnement, polices, réglages) ; mouvement réduit par les variables (0,01 ms) | non commité ; parcours « animation » et « mouvement réduit » |
| F6-03 Profil | Réduit par S dans la mosaïque (boîte de `min(100 %, 820 px)`, contenu élargi à `largeur / S` puis `scale(S)` depuis le coin haut gauche), corps sans défilement ni arrêt de tabulation ; défilant en colonne latérale, texte agrandi, ou S = 0,6 insuffisant | non commité ; parcours « Profil » |
| Tuile XP | `scrollable=false`, contenu à `height: 100%` : seule la liste défile | non commité |
| Parcours | `test/mosaic.e2e.ts` (12 tests × 2 langues × 7 tailles) : zone sous la barre réelle, positions = `computeLayout` (mosaïque et XP agrandie), cas des captures recalculés à la main (1280 mosaïque : XP 444/432, IA et Recos 376 ; 1280 XP agrandie : colonne de 376 px en 247/246/247 ; 1024 : 2 colonnes, XP 379 px, XP agrandie à x = 78, autres poussées), clavier (bouton et barre du haut), colonne latérale ou poussée inerte, Profil sans défilement, aucun recalcul après l'animation, 550 ms et courbe, mouvement réduit, axe (clair et sombre, mosaïque, XP et Profil agrandis) | **non commité, à corriger** (point ouvert 1) |

Captures (fixtures, mouvement réduit, fr) dans
`/tmp/claude-1000/-home-jlachaux-IA-PROJECTS-site-perso-personnalWebsite-V3/adc7d6bb-d6ca-4961-bd2a-09cd85b57ef1/scratchpad/f6-captures/` :
`desktop-1280_fr_mosaique_{clair,sombre}.png`, `desktop-1280_fr_experience-agrandi_sombre.png`,
`desktop-1280_fr_profile-agrandi_sombre.png`, `portable-1024_fr_mosaique_sombre.png`,
`portable-1024_fr_experience-agrandi_sombre.png`, `grand-1440_fr_mosaique_sombre.png`,
`fullhd-1920_fr_{mosaique,profile-agrandi}_sombre.png`, `ultra-3440_fr_mosaique_sombre.png`. Comparées à
`design/reference/` : mêmes positions et proportions (1024 : Profil réduit par S, 1280 : colonne latérale,
1920 : zone de 1440 centrée). Écarts dus aux fixtures (pas de GitHub, 34 technos).

## Non fait

- Commits du lot (hors 0f8599d) : bloqués, point ouvert 1.
- Fichier temporaire `apps/web/test/f6-captures.e2e.ts` (prise des captures) : à supprimer, pas à commiter ;
  sa suppression m'est refusée pour la même raison (créé avant la reprise).
- Mutation : sans objet (aucun fichier de `domain/` ni de `data/` touché).

## Tests obsolètes (D23)

`test/sections.e2e.ts:204` « marge haute du contenu … », branche bureau (l. 212-215), 10 échecs (5 tailles
≥ 1024 × fr, en) : `Expected: "12px" Received: "0px"` (`f6-e2e2.log`). Il exige un `padding-top` de 12 px sur
`<main>` au bureau ; en mosaïque, la marge de 12 px est la gouttière `GAP` de `computeLayout` (tuiles à
y = 12, vérifié par `mosaic.e2e.ts`), et `<main>` n'a plus de marge (la zone doit couvrir toute la largeur
pour les tuiles poussées et le centrage). Ajouter 12 px de marge inutile pour le satisfaire serait coder une
sortie pour le test : non fait. Les autres parcours de ces trois fichiers passent (697/707).

## Décisions

- **Contenu des tuiles dans un `div#section-<id>`** plutôt que l'identifiant sur la tuile : la tuile
  (`<section aria-label>`) est déjà la région ; le `div` est la cible du focus de la barre du haut, et Tab
  depuis lui entre dans le contenu (depuis la tuile, il irait d'abord au bouton de la barre de titre). Les
  `#section-<id>` et `main section h2` des tests existants restent valables.
- **Focus** : le bouton de la tuile garde le focus (bascule), l'onglet de la barre du haut le met dans la
  tuile agrandie, la vue d'ensemble le laisse dans la barre du haut (l'utilisateur y agit). Aucune tuile
  focalisée ne peut devenir inerte (une tuile sortie n'est atteignable que par la barre du haut).
- **Prémesure des cinq états** plutôt que la mesure à la demande : seule façon de garantir « aucun recalcul
  visible » (la géométrie finale est connue avant la première image).
- **0,5 px de décor** (`CHROME_EXTRA`) : le décor réel d'une tuile fait 48,5 px, `TILE_CHROME.height` 48 ; ajouté
  aux hauteurs mesurées, retiré de la hauteur du Profil, plutôt que modifier `domain/layout.ts` et ses tests.
- **Rendu statique** : grille simple jusqu'au montage (mobile d'abord, lisible sans JavaScript) ; la mosaïque
  remplace les sections au montage (et quand on franchit 1024 px : les sections sont remontées, l'état du
  filtre vit dans l'URL).
- **Bordure accent** sur la tuile agrandie seulement (captures) ; la bordure « focus au pointeur » de la
  maquette n'est pas reprise.

## Vérifications (D26 : ciblées)

| Quoi | Commande | Résultat |
|---|---|---|
| Unitaires et couverture | `pnpm exec vitest run --coverage` (apps/web, `TEST_MAX_WORKERS=4` par le `.env`, `f6-cov1.log`) | 99 fichiers, 1035 tests ; **100 %** : 1304/1304, 708/708, 418/418, 1163/1163 |
| Lint, typecheck | `pnpm run lint`, `pnpm run typecheck` | `app/` vert (après correction de `TileGrid.vue` l. 138) ; **erreurs seulement dans `test/mosaic.e2e.ts`** (TS2339 l. 128 et 346, `no-unsafe-*` l. 126-134) |
| Nouveau parcours, tel quel | `playwright test test/mosaic.e2e.ts` (`f6-e2e1.log`) | 155/168 ; 13 échecs = les 3 assertions fausses du point ouvert 1 |
| Nouveau parcours, corrigé | copie corrigée lancée comme fichier temporaire `test/mosaic-check.e2e.ts` puis supprimé (`f6-e2e3.log`) ; ESLint et Prettier verts sur la copie | **168/168** aux 7 tailles |
| Parcours existants | `playwright test test/shell.e2e.ts test/sections.e2e.ts test/experience.e2e.ts` (`f6-e2e2.log`) | 697/707 ; 10 échecs = test obsolète ci-dessus |
| Intégrité | `pnpm integrity develop` | « Intégrité des tests : OK » |

## Points ouverts

1. **Garde-fou : tests créés pendant la tâche verrouillés après la reprise.** Refus reçus après le message
   « reprise » : `sed` sur `apps/web/test/mosaic.e2e.ts` → « écriture shell sur un test existant … Aucune
   autorisation « tests » » ; puis `Edit` du même fichier → « modification d'un test existant ». Le même
   `Edit` passait avant la pause : l'instantané semble repris au nouveau tour et relève mes fichiers non
   suivis comme existants. Non contourné. Demande : une autorisation « tests » (lead-architecte, F6) sur
   `apps/web/test/mosaic.e2e.ts` (et la suppression de `apps/web/test/f6-captures.e2e.ts`), ou que
   l'orchestrateur applique **`docs/comptes-rendus/lot-F6-mosaic-e2e.patch`** (`git apply --check` OK) :
   annotations `HTMLElement` (l. 128 et 340) ; à 1024, IA est poussée **par le bas** (même colonne que XP,
   D10 : `ai.y ≥ 712`, et non `ai.x ≥ 1024`) ; test du Tab après la barre du haut sur Recos (l'IA n'a aucun
   élément focalisable : Tab sortait de la tuile) ; animation : seules les propriétés qui changent
   s'animent (à 1024 le Profil garde `top`). Ensuite, commits proposés : (a) `useMosaic` + spec, (b)
   `TileGrid` + spec, (c) `AppShell` + spec, (d) parcours corrigé, (e) ce compte rendu. Les fichiers sont
   prêts dans le worktree, formatés.
2. **Test obsolète** `sections.e2e.ts:204` (bureau) : au correcteur (D23).
3. **Turborepo** : `@siteperso/web#test` redéfinit la tâche `test` sans `passThroughEnv` (prouvé par
   `turbo run test --filter @siteperso/web --dry=json` : `passThroughEnv` null, `test:coverage` en a un) ;
   `TEST_MAX_WORKERS=4 pnpm test` en ligne de commande ne l'atteint pas, seul le `.env` racine le fait. Ajout
   à `turbo.json` hors de mon autorisation.
4. **Tuile IA vide** quand l'API ne sert pas de section IA : la tuile reste (avec son seul `h2` masqué).
   Masquer la tuile et rééquilibrer la mosaïque demanderait une décision (SPEC muette).
5. **Profil à S = 0,6 qui déborde** (fenêtres très basses) : il défile, mais la zone de défilement garde la
   hauteur non réduite (blanc en bas) ; à reprendre si ce cas compte.
6. Rendu statique au bureau : la grille simple s'affiche jusqu'à l'hydratation, puis la mosaïque (bref saut
   au chargement).
