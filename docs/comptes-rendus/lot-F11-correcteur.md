# Lot F11 : corrections (correcteur)

Date : 26 nov. 2026. Branche `lot/F11-optimisation`. Autorisations (recréées par l'orchestrateur dans l'état
du worktree après un premier arrêt, voir « Incident ») : `8330042e` (RC-5), `1f9bdbed` (RC-7).

## Résultat

| Finding | Commit | Ce qui change | Preuve |
|---|---|---|---|
| RC-5 | `21e871c` | `useSiteSeo` ne pose plus de description (ni `og:description`) : chaque page indexée a la sienne par `usePageSeo`. `seo.description` (nom en dur) supprimée, `seo.homeDescription` renommée `seo.description` (`HomePage.vue`). `useSeo.spec.ts` : les deux tests de `useSiteSeo` attendent l'absence de description. Texte de production identique. | voir RC-5 ci-dessous |
| RC-7 (=), 6 parcours | `90759f0` | ai-placeholder, boot, chip-counter-contrast, chip-pressed-mark, client-bundle, controls | 413 tests avant et après |
| RC-7 (=), 4 parcours | `7e96c25` | csp, cv, defects-f8, design-system | 301 avant et après |
| RC-7 (=), 17 parcours | `18c9b04` | experience, hydration-shift, journeys, language-switch-d43, matrix, mosaic, overflow, pages, sections, server-error, shell, short-height, smoke, title-overflow, top-bar-height, work-in-progress | 1 715 avant et après |
| RC-7 D51 (2) | `acfd0ae` | pages, work-in-progress, hydration-shift : `expectAxeClean` | 238 passés, aucun défaut révélé |
| RC-7 (≈) | `35fdb37` | mosaic, sections, experience, hydration-shift : `waitForSettledAnimations(page, portée)`, axe de mosaic par `expectAxeClean` | 784 avant et après |

Le dernier commit « docs » (ce fichier) ne touche aucun test.

## RC-5

Test d'abord : `pnpm exec vitest run app/composables/seo/useSeo.spec.ts` avant la correction de production :

```
FAIL useSiteSeo > pose un Open Graph minimal … sans description ni nom
FAIL useSiteSeo > en anglais : pas non plus de description par défaut
  Received: "Website and CV of Julien Lachaux, full-stack developer: …"
  Tests  2 failed | 1 passed (3)
```

Après : `useSeo.spec.ts`, `i18n-messages.spec.ts`, `i18n-hardcoded.spec.ts`, `components/home` : 8 fichiers, 28 tests
verts. Site régénéré (`generate:fixtures`), méta description par page :

| Page | Description |
|---|---|
| `/`, `/en` | `Site et CV de Prénom Nom, développeur full-stack : …` / `Website and CV of Prénom Nom, full-stack developer: …` (fixtures ; en production le nom du CV : texte identique à l'ancien) |
| `/accessibilite`, `/en/accessibility` | la leur (`usePageSeo`) |
| `/travaux`, `/en/work-in-progress` | la leur (nom en dur, exception D51 (1), inchangée) |
| `200.html`, `404.html`, `50x.html`, `/en/404.html`, `/en/50x.html` | aucune, comme avant : `error.vue` n'appelle pas `useSiteSeo` (pages noindex) |

Parcours `pages`, `work-in-progress`, `smoke`, `server-error` : 392 passés (98 + 98 + 35 + 161). `test:coverage` du front
100 % (1472/1472, 797/797, 490/490, 1310/1310). `lint` et `typecheck` verts.

`Justification-test: RC-5` : `useSeo.spec.ts:53-71` attendait le texte par défaut avec « Julien Lachaux » ; la description
par défaut n'existe plus, le test attend son absence (échec montré ci-dessus avant la correction).

## RC-7 : migration des parcours

Suppression des définitions locales (`WCAG_22_AA`, `STORAGE_KEY` sauf `boot`, `shell` et `journeys` qui lisent la clé,
`tabsMode`, `storePreferences`, `PALETTES` quand identique, `open`/`hydrated`/`settled`/`waitForSettledAnimations`/`axe`)
au profit de `./support/e2e.js`. Le module n'a pas été modifié ; rien ne lui manquait.

Nombres de tests : relevés avant par `playwright test --list <fichier>`, puis passés après par fichier ou groupe
(`--workers=2`). Ils concordent : ai-placeholder 126, boot 49, chip-counter-contrast 56, chip-pressed-mark 63,
client-bundle 56, controls 63 (413) ; csp 63, cv 56, defects-f8 28, design-system 154 (301) ; hydration-shift 42,
journeys 56, language-switch-d43 21 (119) ; experience 476, matrix 112 (588) ; mosaic 182, overflow 14, pages 98,
sections 84, server-error 161, shell 147, short-height 112, smoke 35, title-overflow 70, top-bar-height 7,
work-in-progress 98 (1 008) ; aucun test sauté (le total listé égale le total passé). Non touchés : action-bar-keyboard,
panel-link-target (rien à migrer), e2e-support (le module).

`grep -n "const WCAG_22_AA\|const STORAGE_KEY\|function tabsMode\|endTime === Infinity" apps/web/test/*.e2e.ts` : vide.

### Renforcements axe (D51 (2)) et leur résultat

| Parcours | Avant | Après (`expectAxeClean`) | Résultat |
|---|---|---|---|
| pages (déclaration, 404) | violations, `passes` non vide | + animations finies terminées, `color-contrast` mesuré | vert, 98 |
| work-in-progress | idem | idem | vert, 98 |
| hydration-shift (avant le montage) | violations seules | idem | vert, 42 : aucun défaut révélé |

Aucun vrai défaut n'est apparu ; rien n'a été affaibli.

### Gardé en local (plan)

Curseur de `ai-placeholder` (attente `finished` locale) ; `PALETTES` de ai-placeholder, matrix (ordre clair d'abord) et
design-system (couleurs attendues, autre forme) ; `cspHash`, `buildPolicy`, `strictPolicy` (RC-8, F11-05) ;
`waitForTimeout(400)` de `cv.e2e.ts` (RC-9) ; attente `[data-mode="tabs"]` de short-height et title-overflow (plus
stricte que `gotoMounted`) ; `data-mode="mosaic"` de language-switch-d43 (hors plan) ; commentaire périmé de sections.e2e.ts
(RC-10, hors périmètre).

### Variantes (≈) (commit `35fdb37`)

`waitForSettledAnimations(page, portée)` remplace l'attente par `finished` de experience (section), sections (section),
mosaic (grille, ~20 appels) et hydration-shift (grille) : même résultat sur les fixtures (784 passés). Le plan marquait
aussi l'`axe` de mosaic (attente ajoutée) : fait avec les (≈). Le test de mosaic « aucun recalcul »
(`getAnimations({ subtree: true }).length === 0`) est inchangé.

## Incident (premier passage)

Les autorisations `7250baa9` et `21b2ac9a` avaient été écrites dans l'état du checkout principal, pas dans celui du
worktree f11 (`CLAUDE_PROJECT_DIR`) : le hook refusait toute édition de test. Je m'étais arrêté sans rien modifier
(commit `58dedd5`, remplacé par ce compte rendu). L'orchestrateur les a recréées (`1f9bdbed`, `8330042e`).

Deux fausses manœuvres pendant la reprise, sans conséquence sur l'état livré : une passe de référence de 2 632 tests
interrompue (processus hôte du lanceur uniquement ; un `sirv` resté ouvert sur le port 6021 a dû être arrêté), et une
erreur de ligne dans `hydration-shift` (suppression de `page.unrouteAll()` au lieu de l'attente du montage) attrapée par
la première exécution (14 échecs `data-mode`), corrigée avant tout commit. Rien de podman n'a été touché.

## Vérifications finales

- `pnpm --filter @siteperso/web lint` et `typecheck` : verts (le hook pre-commit les rejoue à chaque commit).
- `pnpm --filter @siteperso/web test:coverage` : 100 %.
- Tous les parcours migrés, `--workers=2` : voir les groupes ci-dessus, tous verts (aucun échec).
- `pnpm integrity` : OK.
- Conteneur des navigateurs : intact ; pas de base de test ni de pile utilisées (front seul).

## Décisions

- Les (≈) et (!) dans des commits séparés, comme demandé ; hydration-shift est dans les deux (axe strict, puis attente de la
  grille).
- `CLAUDE.md` (l. 184-185) et `docs/04-front-donnees.md` citent encore `seo.homeDescription` : fichiers que l'entrée RC-5 ne
  cite pas, non modifiés.

## Points ouverts

- Mettre à jour `CLAUDE.md` et `docs/04-front-donnees.md` (`seo.homeDescription` devient `seo.description`, plus de description
  par défaut dans `useSiteSeo`).
- Le site de production publie encore l'ancien libellé tant que le front n'est pas régénéré ; rien à faire côté contrat.
- RC-8 (empreintes CSP locales à csp, work-in-progress, server-error), RC-9 (`waitForTimeout(400)` de cv), RC-10 (commentaire
  de sections) restent à traiter.
- Contraste mesuré des 404 et pages annexes : vérifié par `expectAxeClean` désormais ; la déclaration et la page travaux sont
  les seules à passer par la page hydratée.

## D51-4 : `control-tokens.spec.ts` ignore la requête `(min-width: 1024px)`

Test faux par omission (autorisation 63986733) : la table `MEDIA` refuse toute requête inconnue, or la règle du bureau de
D51 (4) ne porte que des polices. Ajout de l'entrée `'(min-width: 1024px)': () => true` (commentaire : seules les piles de
polices en dépendent). Vrai plutôt que faux : la règle entre dans la cascade, donc une couleur qu'elle poserait serait vue.
Aucune assertion, aucun seuil, aucune autre entrée modifiés ; `tokens.css` inchangé dans le commit.

1. Code actuel (sans règle du bureau) : `vitest run app/assets/css/` : 5 fichiers, 48 tests verts.
2. Règle du bureau posée temporairement en fin de `tokens.css` (texte exact demandé) : mêmes 5 fichiers, 48 tests verts.
   Sans l'entrée `MEDIA`, c'était l'erreur `requête média inconnue : (min-width: 1024px)` (cf. compte rendu du lead).
   `tokens.css` restauré par `git checkout`.
3. Témoin, honnêtement :
   - Une règle `@media (min-width: 1024px) { :root { --bg: #777777; --line-control: #777777; } }` à spécificité 1 ne fait
     PAS échouer le test (48 verts) : dans chaque état, des règles de palette plus spécifiques ou postérieures l'emportent,
     et la cascade du test les calcule comme le navigateur. Ce n'est donc pas un trou de l'oracle, la couleur posée serait
     réellement écrasée.
   - La même déclaration sous un sélecteur de spécificité 6 (`:root:not([data-x])…` répété) fait échouer 7 tests
     « --line-control atteint 3:1 sur chaque fond opaque ». L'oracle voit donc une couleur du bureau qui s'imposerait.
   - Limite : seuls `--bg`/`--line-control` et les fonds listés sont contrôlés, pas les autres couleurs ; la valeur `true`
     ne vérifie pas le cas de largeur inférieure à 1024 px (par construction, seules les polices changent).

Vérifications : voir le message de fin (vitest css, lint, integrity).

## F11-05 (RC-8)

Autorisation `a1c5d658` (D40) : `csp.e2e.ts`, `server-error.e2e.ts`, `work-in-progress.e2e.ts` importent
`buildPolicy` et `collectHashes` de `scripts/deploy/csp-hashes.mjs` au lieu d'en copier la politique.

| Finding | Commit | Ce qui change | Preuve |
| ------- | ------ | ------------- | ------ |
| RC-8 | voir `git log` (sujet `test(web): RC-8 …`) | Les copies locales (`cspHash`, `htmlFiles`, `inlineHashes`, `strictPolicy`) disparaissent ; la politique est celle du déploiement, donc `img-src 'self'` (les copies gardaient `img-src 'self' data:`). Commentaire de tête de `csp.e2e.ts` corrigé. | 63 + 161 + 98 = 322 tests, avant et après, tous passés (`--workers=2`, 7 projets) ; typecheck, lint, `apps/api/test/csp-hashes.e2e-spec.ts` (6) et `pnpm integrity develop` verts. |

- Témoin : `font-src 'self'` remplacé temporairement par `'none'` dans `csp-hashes.mjs` : les parcours CSP des trois
  fichiers échouent (projet desktop-1280 : tous les tests CSP en échec) ; script restauré par `git checkout`.
- Écarts relevés entre copies et script, hors `img-src` : aucun de substance. Les copies de `server-error` et
  `work-in-progress` écartaient les scripts dont le type commence par `application/json` ou `application/ld+json` ;
  le script écarte ces deux types exacts (insensible à la casse) ; pas de différence sur les pages générées.
- Typage : aucun `.d.mts` nécessaire, `vue-tsc -b` accepte l'import du `.mjs`.
- Le site ne charge aucune image `data:` : les 322 tests passent sous `img-src 'self'`.
- Point ouvert : `pnpm db:down` (fin de liste) a aussi retiré le réseau du projet, donc probablement arrêté le conteneur
  playwright du worktree ; à relancer par `pnpm e2e:browsers:up` si besoin.

## F11-REVUE-1 : sections masquées sans JavaScript sous 1024 px (revue de la PR 33)

Constat de la revue (non bloquant, établi juste) : avant le montage, sous 1024 px, `TileGrid` masquait
Expérience, Recommandations et IA ; sans JavaScript la navigation du bas ne marche pas, ces sections
étaient donc inaccessibles. Décision de l'orchestrateur : les quatre sections restent dans le flux.

| Finding | Commit | Ce qui change | Preuve |
| ------- | ------ | ------------- | ------ |
| F11-REVUE-1 | voir `git log` (sujet `fix(web): F11-REVUE-1 …`) | `TileGrid.vue` : les tuiles autres que le Profil ne sont plus `display: none` sous 1024 px, séparées par `margin-top: var(--tile-padding)` ; `AppShell.vue` : la règle « une section à la fois » exclut les sections de la mosaïque d'avant le montage (`--tile`), cause réelle du masquage de ces sections. | Voir ci-dessous. |

- Tests modifiés (autorisation `aa77a7c3`) : `TileGrid-premount.spec.ts` (le test décrivait le masquage :
  `display: none` devient `display: block` pour toutes les tuiles et `margin-top` pour les autres) et
  `hydration-shift.e2e.ts` (`[data-tile]:visible` vaut 4 et dans l'ordre Profil, Expérience,
  Recommandations, IA ; le reste est inchangé : Profil identique avant et après le montage, barres masquées,
  barre du haut cachée, navigation du bas, axe).
- Nouveau test : `hydration-shift.e2e.ts`, « sans JavaScript, le texte de chaque section est lisible » (un `h1`,
  un `h2` par section, section rendue et texte visible).
- Avant la correction : le test unitaire échoue (`expected 'none' to be undefined`), le parcours sur mobile-390 et
  tablette-834 échoue (`[data-tile]:visible` : attendu 4, reçu 1). Après la seule correction de `TileGrid.vue`, il
  restait 2 tuiles visibles : `AppShell.vue` masquait aussi les sections (`.app-shell__section:not(--current)`), d'où
  la seconde correction.
- Après : `hydration-shift`, `shell`, `sections` sur mobile-390, tablette-834, portable-1024 et desktop-1280 : 164
  passés ; lint, typecheck verts ; `test:coverage` du front : 1239 tests, 100 %.
- Point ouvert : le `h2` de chaque section est masqué visuellement (`visually-hidden`) avant le montage, comme avant
  la PR ; seule la section Profil a un grand titre visible.
