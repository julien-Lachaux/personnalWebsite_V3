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
