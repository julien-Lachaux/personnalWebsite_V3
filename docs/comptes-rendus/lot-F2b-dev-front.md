# Lot F2b : logique pure de la mosaïque, du facteur S et des préférences (dev-front)

Date : 20 novembre 2026. Branche `lot/F2b-tuiles` (worktree `.claude/worktrees/lot-F2b-tuiles`), depuis
`develop` (b5bf2e4). Isolation : `COMPOSE_PROJECT_NAME=siteperso-v3-f2b`, `POSTGRES_PORT=5872`,
`POSTGRES_TEST_PORT=5873`, `PLAYWRIGHT_PORT=5874`, `WEB_E2E_PORT=5875`. Fichiers écrits : uniquement
`apps/web/app/domain/{layout,layout-types,fit,preferences}.ts` et `{layout,fit,preferences}.spec.ts`
(plus ce compte rendu). Aucun test existant modifié, aucun fichier partagé touché.

## Fait

| Ticket | Livré | Preuve |
|---|---|---|
| F2-02 `layout` | `computeLayout(input)` : onglets (mobile < 768, tablette 768-1023 sur colonne de 640 px centrée), mosaïque 2 colonnes (1024-1199) et 3 colonnes (≥ 1200), zone plafonnée à 1440 px et centrée, marges et gouttières de 12 px, Profil à la hauteur de son contenu (3 colonnes) sinon pleine hauteur, tuile agrandie de `min(dispo, 868)` (hauteur de contenu pour Profil, IA, Recos, pleine pour XP), colonne latérale dès 340 px restants (parts égales, ordre Profil, XP, Recos, IA), empilement Profil + IA quand les deux tiennent, poussée hors zone, mode du Profil (`reduced` ou `scrolling`) avec largeur et hauteur à passer à `fit` | `layout.spec.ts`, 50 tests ; cas des captures : desktop 1280×844 en mosaïque (IA et Recos de 376 px), XP agrandie à 1280 (tuile 868 px, colonne latérale de 376 px en trois tuiles de 247, 246, 247 px), portable 1024 (Profil 360 px pleine hauteur, XP à 56 %, XP agrandie centrée à x = 78 sans place latérale), 1440, 1920 (zone décalée de 240 px) et 3440 (1000 px) |
| F2-03 `fit` | `computeFit(measure, request)` et `createFitCache(measure)` : dichotomie entre 0,6 et 1 sur une fonction de mesure injectée, élargissement `largeur / S` (largeur de base plafonnée à 820 px), S = 1 quand le contenu tient (tolérance 0,5 px), désactivé (S = 1) quand le texte est agrandi, cache par (largeur, hauteur arrondie, texte agrandi) invalidable | `fit.spec.ts`, 18 tests ; S comparé au S exact (équation du second degré d'un texte qui se recompose) : jamais au-dessus, à moins d'un millième |
| F2-04 `preferences` | modèle (thème `sombre`/`clair`, taille 100/115/130, contraste renforcé, police lisible, espacement, soulignement des liens, animations réduites), `defaultPreferences(system)`, sérialisation versionnée, `parsePreferences`, `loadPreferences`, `savePreferences`, `resetPreferences` avec stockage injecté `getItem/setItem` qui ne lève jamais | `preferences.spec.ts`, 29 tests |

Vérifications :

- Couverture : 100 % (instructions 168/168, branches 73/73, fonctions 30/30, lignes 153/153) sur
  `app/domain`, une fois `pnpm test:coverage` complet (voir ci-dessous pour `pnpm check`).
- **Mutation (réserve R1 de la recette F0) levée** : `pnpm --filter @siteperso/web test:mutation` mute
  bien les fichiers de `app/domain/` (la liste de `mutate` de `stryker.config.mjs` les atteint, le
  projet `unit` les exécute) : `fit.ts` 100,00 (43 tués, 1 timeout), `layout.ts` 100,00 (246 tués),
  `preferences.ts` 100,00 (75 tués), score total 100,00, aucun survivant, aucune directive
  `Stryker disable`, aucun équivalent déclaré. Le seuil de rupture 100 mord désormais : une première
  passe avait donné 98,12 % avec 7 survivants, tous traités par un changement de code (voir
  « Décisions », dernier point), pas par un test affaibli ni une exclusion.
- `pnpm format`, `pnpm check`, `pnpm integrity develop` : voir « Vérifications finales » en bas.

## API publique

`layout.ts` (types dans `layout-types.ts`)

- `computeLayout({ zone, expanded, textEnlarged, contentHeight }): Layout`.
  - `zone` : `{ width, height }`, largeur de la fenêtre et hauteur sous la barre du haut (mobile et
    tablette : valeurs ignorées hors largeur).
  - `expanded` : `TileId | null`, avec `TileId = 'profile' | 'experience' | 'recommendations' | 'ai'`.
  - `textEnlarged` : texte à 115 % ou 130 %.
  - `contentHeight(tile, innerWidth): number | undefined` : hauteur du contenu composé à la largeur
    intérieure donnée (sans barre de titre ni bordures), `undefined` tant que non mesuré. Le composable
    mesure sur un clone hors écran et met en cache par (tuile, largeur).
- Résultat `Layout = TabsLayout | MosaicLayout`, discriminé par `mode`.
  - `{ mode: 'tabs', device: 'mobile' | 'tablet', column: { x, width } }`.
  - `{ mode: 'mosaic', columns: 2 | 3, area, expanded, tiles, profile }` : `area` est la zone des
    tuiles plafonnée à 1440 px et centrée, dans le repère de la zone entière ; `tiles` est un
    `Record<TileId, TileLayout>` ; chaque `TileLayout` donne `rect` (x, y, width, height en px dans le
    repère de la zone), `visible` (faux pour une tuile poussée : `visibility: hidden` après les 550 ms
    et `inert`), `placement` (`mosaic | expanded | stacked | side | pushed`) et `push`
    (`left | right | top | bottom | null`).
  - `profile` : `{ mode: 'reduced' | 'scrolling', contentWidth, availableHeight }`. En `reduced`, le
    composable appelle `fit.fit({ width: contentWidth, availableHeight, textEnlarged })` ; en
    `scrolling` (colonne latérale, texte agrandi), S = 1 et la tuile défile.
- Constantes exportées : `TILE_ORDER`, `GAP`, `PAGE_MAX_WIDTH`, `EXPANDED_MAX_WIDTH`,
  `SIDE_MIN_WIDTH`, `TABLET_COLUMN_WIDTH`, `BREAKPOINTS`, `TILE_CHROME` (`{ width: 3, height: 48 }` :
  bordures de 1,5 px des deux côtés, barre de titre de 44 px et bordures, valeurs des maquettes).

`fit.ts`

- `computeFit(measure, { width, availableHeight, textEnlarged }): { scale, contentWidth, overflows }`.
  `measure(width)` rend la hauteur du contenu composé à cette largeur, sans échelle. `contentWidth` est
  la largeur à donner au contenu avant `scale(S)` (`min(width, 820) / S`, la valeur du `max-width`
  CSS en même temps). `overflows` : le contenu dépasse encore à ce S (S minimal atteint, ou texte
  agrandi) ; la tuile doit alors défiler.
- `createFitCache(measure): { fit(request), invalidate() }` : même résultat, mémorisé par (largeur,
  hauteur disponible arrondie au pixel, texte agrandi) ; `invalidate()` quand la langue, les polices
  (`document.fonts.ready`) ou le contenu changent.
- Précision : 10 pas de dichotomie sur [0,6 ; 1] (pas < 0,0004), puis arrondi à l'inférieur au
  millième : S ne dépasse jamais le plus grand S qui tient et le manque de moins de 0,001.
  Constantes : `FIT_MIN_SCALE`, `FIT_ITERATIONS`, `FIT_TOLERANCE`, `FIT_PRECISION`,
  `FIT_MAX_CONTENT_WIDTH`.

`preferences.ts`

- Types `Preferences` (`theme: 'sombre' | 'clair'`, `textSize: 100 | 115 | 130`, `highContrast`,
  `readableFont`, `textSpacing`, `underlineLinks`, `reduceMotion`), `SystemPreferences`
  (`prefersDark`, `prefersReducedMotion`), `PreferencesStorage` (`getItem`, `setItem`).
- `defaultPreferences(system)`, `serializePreferences(p)`, `parsePreferences(raw, defaults)`
  (`null` si illisible ou d'une autre version ; champ invalide : valeur par défaut de ce champ),
  `loadPreferences(storage, system): { preferences, status }` avec
  `status = restored | empty | invalid | unavailable | error`, `savePreferences(storage, p):
  saved | unavailable | error`, `resetPreferences(storage, system): Preferences` (écrit les valeurs
  par défaut). Clé unique `siteperso:preferences`, document JSON `{ version: 1, … }`.
  `storage` vaut `null` ou `undefined` quand il n'y en a pas (rendu statique) ; l'obtention de
  `window.localStorage` peut elle-même lever (cookies bloqués) : l'appelant la protège et passe `null`.

## Décisions

- **Profil en 2 colonnes = pleine hauteur** (SPEC § 3.3 et maquette portable `profTileH = AH`), à
  la différence du 3 colonnes où il s'arrête à la hauteur de son contenu (SPEC § 4.1, maquette
  desktop). Dans les deux cas il reste réductible par S.
- **Tailles entières** : les maquettes utilisent des `calc()` fractionnaires ; le domaine arrondit au
  pixel (parts égales par arrondi cumulé, XP à 56 % arrondie, IA et Recos prennent le reste) pour qu'il
  n'y ait ni trou ni recouvrement. Écart d'au plus 1 px avec la maquette (colonne latérale de XP agrandie à
  1280 : 247, 246, 247 px au lieu de 246,67 chacun).
- **Poussée par le haut** : la SPEC cite gauche, droite et bas ; la maquette pousse aussi vers le haut
  une tuile de même colonne située au-dessus de la tuile agrandie (IA quand Recos est agrandie en 3
  colonnes sans place latérale, XP quand IA est agrandie en portable). `push: 'top'` le reproduit.
  Une tuile sort de la zone entière (`x = -largeur`, `x = zone.width`, `y = -hauteur`, `y = zone.height`),
  pas de 1400 ou 1100 px comme la maquette, qui n'est sûre qu'à 1440 px.
- **Mesures par largeur** : `contentHeight(tile, innerWidth)` est appelé à la largeur exacte où la
  tuile sera posée (865 px pour une tuile agrandie, 417 ou 357 px pour le Profil de la mosaïque), au
  lieu des mesures à 868 px de la maquette (`natW`). Le Profil est aussi mesuré à sa largeur de
  mosaïque quand une tuile est agrandie (sa place s'il est poussé) ; le composable met les résultats
  en cache par (tuile, largeur).
- **Hauteur non mesurée** : traitée en interne comme infinie (tuile pleine hauteur, jamais empilée),
  d'où l'absence de gardes `undefined` dans le calcul.
- **Texte agrandi** : paramètre de `computeLayout` (le Profil passe en `scrolling`, S = 1) et de `fit`
  (S = 1, `overflows` dit si le contenu dépasse) ; la hauteur de la tuile n'en dépend pas.
- **Absence de stockage** : `loadPreferences` et `savePreferences` distinguent `unavailable` (pas de
  stockage), `error` (le stockage lève) et, en lecture, `empty` / `invalid`. L'information est utile à
  l'interface (suivre `prefers-color-scheme` tant que rien n'est stocké) et rend chaque branche
  observable par un test, sans mutant équivalent.
- **Valeurs de `Theme`** : `'sombre'` et `'clair'`, celles de `data-theme` (SPEC § 9). La taille du
  texte est le nombre (100, 115, 130) ; le composable choisit l'attribut racine correspondant (la
  maquette a `data-ts` md, lg, xl).
- **Réinitialisation** : écrit les valeurs par défaut du système dans le stockage (le contrat
  `getItem/setItem` n'offre pas de suppression). Elles se confondent avec « aucun choix » tant que le
  système ne change pas.
- **Mutation** : les survivants de la première passe étaient des gardes redondantes (`undefined`
  suivi d'une arithmétique qui donne `NaN`, décalage nul, table de partenaires d'empilement, `catch`
  vide d'un analyseur JSON). Le code a été simplifié ou rendu observable plutôt que d'ajouter des
  équivalents déclarés.

## Non fait

- Aucun composant ni composable : `TileGrid`, `FitToHeight`, mesure sur clone, `ResizeObserver`,
  application des préférences sur la racine et lecture de `matchMedia` relèvent de F3 et F6.
- La lecture de `prefers-reduced-motion` en direct (changement du système pendant la session) n'est pas
  traitée : le domaine ne reçoit que la valeur au moment de l'appel.

## Points ouverts

- **Animation du Profil** : S est calculé pour la géométrie finale ; pendant les 550 ms, le composable
  devra animer `left`, `top`, `width`, `height` et `scale` ensemble (SPEC § 4.2). Le domaine donne
  l'état de départ et d'arrivée, pas l'interpolation.
- **Profil `reduced` poussé** : le Profil hors zone garde sa géométrie de mosaïque et son mode
  `reduced`, comme dans la maquette, pour que S soit déjà en cache au retour. Le composable peut éviter
  de mesurer un Profil invisible si cela coûte trop.
- **Hauteur de zone** : `zone.height` doit être la hauteur réelle sous la barre du haut (788 px pour
  1280×844 : 844 − 56). Pas de borne basse dans le domaine : une zone de moins de 24 px donnerait des
  hauteurs négatives.
- **`TILE_CHROME.height` = 48 px** : valeur de la maquette (barre de 44 px, bordures de 3 px,
  1 px de marge d'arrondi). À vérifier contre le CSS de la tuile (F1) ; un autre chrome se règle en
  une constante.
- **Demande de changement partagé** : aucune.

## Vérifications finales

- `pnpm format` : propre (aucun fichier modifié ensuite).
- `pnpm check` : code 0 (garde-fous des hooks, intégrité, postgres de test, lint, typecheck, unitaires,
  e2e API 753 tests, Playwright front 35 tests, couverture fusionnée) ; couverture 100 % sur
  `apps/web/app` (185/185 instructions), `packages/contracts` (59/59) et `apps/api` (765/765).
- `pnpm integrity develop` : « Intégrité des tests : OK » (aucun test existant modifié).
- `pnpm --filter @siteperso/web test:mutation` : score 100,00, aucun survivant.
- `pnpm db:down` exécuté en fin de lot.
