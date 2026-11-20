# Lot F3b : composants de la coquille et de la navigation (dev-front)

Date : 20 novembre 2026. Branche `lot/F3b-coquille` (worktree `.claude/worktrees/lot-F3b-coquille`), depuis
`develop` (961a2e6). Isolation : `COMPOSE_PROJECT_NAME=siteperso-v3-f3b`, `POSTGRES_PORT=5892`,
`POSTGRES_TEST_PORT=5893`, `PLAYWRIGHT_PORT=5894`, `WEB_E2E_PORT=5895`.

Fichiers écrits : `apps/web/app/components/shell/`, `apps/web/app/composables/shell/`,
`apps/web/i18n/locales/{fr,en}/shell.json`, leurs tests, et, par l'exception nommée du lot,
`apps/web/app/domain/preferences.ts` (D11) et deux nouveaux fichiers de `domain/` (`action-bar.ts`,
`preferences-clear.spec.ts` à côté de `preferences.ts`). Aucun test existant modifié. Rien dans
`nuxt.config.ts`, `app.vue`, `pages/`, `assets/css/`, `components/base/`, `data/`, `common.json`.

## Fait

| Ticket | Livré | Preuve |
|---|---|---|
| F3-02 | `TopBar`, `MobileHeader`, `BottomNav`, `ActionBar`, `ScrollHint` (+ `SectionIcon`, `HeaderControls`) ; logique de masquage et de flèche dans `domain/action-bar.ts` | un `*.spec.ts` par composant ; `action-bar.spec.ts` (22 tests) |
| F3-04 | `AccessibilityPanel` (`accessibilite.cfg`) sur `Popover` : déclencheur `aria-haspopup="dialog"`, focus sur le premier réglage, taille du texte 100/115/130 (`SegmentedControl`), 5 `Switch`, Réinitialiser (D11), lien « Déclaration d'accessibilité » (prop), statut « [à compléter après audit] », annonce de la réinitialisation (`role="status"`) | `AccessibilityPanel.spec.ts` (25 tests) |
| F3-05 | `ContactButton` (`mailto:` depuis `useRuntimeConfig().public.contactEmail`, sujet prérempli et traduit), `CvButton` (`download`, lien reçu en prop) | `ContactButton.spec.ts`, `CvButton.spec.ts`, `useContactLink.spec.ts` |
| F3-02 (sélecteurs) | `LanguageSwitch` (lien vers la même page dans l'autre langue, `lang` et `hreflang`), `ThemeToggle` (nom qui annonce le thème et l'action) | `LanguageSwitch.spec.ts`, `ThemeToggle.spec.ts` |
| Préférences | `usePreferences` (état partagé `useState`, stockage, réinitialisation), `usePreferencesSync` (matchMedia, attributs de `<html>`, retrait des écouteurs) ; **D11** : `clearPreferences` + contrat `RemovablePreferencesStorage` (`removeItem`) | `usePreferences.spec.ts` (21), `usePreferencesSync.spec.ts` (16), `preferences-clear.spec.ts` (5) |
| Défilement | `useActionBar` (seuil 24 px, verrou 360 ms, retour au changement d'onglet), `useScrollHint` (`ResizeObserver`, `MutationObserver`, `document.fonts.ready`, `scrollDown`) | `useActionBar.spec.ts` (11), `useScrollHint.spec.ts` (16) |
| Libellés | `i18n/locales/{fr,en}/shell.json`, mêmes clés (vérifié par `i18n-messages.spec.ts`) | |

Contrôles :

- **Couverture 100 %** sur les quatre métriques de `apps/web/app` (617/617 instructions, 356/356 branches,
  175/175 fonctions, 548/548 lignes avant ce compte rendu ; chiffres finals dans « Vérifications »).
- **Mutation** (`pnpm --filter @siteperso/web test:mutation`) : score 100,00, 634 tués et 1 timeout (déjà là en
  F2b, `fit.ts`), aucun survivant ; `action-bar.ts` 54 mutants tués, `preferences.ts` 85 (dont `clearPreferences`).
  Aucune directive `Stryker disable`, aucun équivalent déclaré. Sonde manuelle de 5 mutants sur les
  composants et composables (`inert` de la barre d'actions, suppression du stockage à la réinitialisation…) : tous tués.
- **axe** (`shell/axe.spec.ts`, 21 tests) : WCAG 2.0/2.1/2.2 A et AA sur chaque composant monté seul, en `/` et `/en`
  (barre du haut avec vue d'ensemble et section courante, barre d'actions visible et masquée, panneau fermé puis ouvert avec
  réglages activés), avec un témoin qui prouve que l'outil détecte une violation.
- **Navigateur réel** (Chromium du conteneur Playwright du projet, Nuxt en `dev`, **page de démonstration temporaire
  `app/pages/zz-shell-demo.vue` supprimée avant tout commit**, comme l'application d'essai de F1b) :
  - axe WCAG 2.2 AA, `color-contrast` et `target-size` compris : 0 violation dans les 4 palettes (sombre, clair, sombre
    renforcé, clair renforcé), à 390 et 1280 px, panneau d'accessibilité ouvert ; 0 violation en texte à 130 % (mobile, 1024,
    1100, 1280 px) ; 0 sur le bureau à 1920 px et la tablette à 834 px ;
  - mobile 390 : en-tête 52,5 px, navigation du bas 64 px, barre d'actions 66 px (après un réglage, voir commit
    dédié), boutons d'en-tête 44 × 44, onglets 98 × 63, boutons d'action 48 px, flèche 44 × 44 à 12 px au-dessus de la
    barre d'actions (elle descend avec elle quand la barre se replie) ; barre d'actions repliée (hauteur 0, `inert`) après
    un défilement de 200 px et revenue après une remontée de 100 px ;
  - bureau 1280 : barre du haut 56 px, boutons 40 px, nom à 24 px du bord ; à 1920 px le nom est à 264 px (contenu aligné
    sur la zone de 1440 px) ;
  - clavier : ordre de tabulation vue d'ensemble, Profil, XP, Recos, IA, Lancer l'entretien, CV PDF, accessibilité, langue,
    thème ; contour de focus 2 px accent décalé de 2 px ; focus sur « Taille de texte normale » à l'ouverture du panneau,
    Échap rend le focus au déclencheur ;
  - réglages : `data-contrast="renforce"` et `data-text-size="130"` posés sur `<html>`, document JSON écrit sous
    `siteperso:preferences` ; « Réinitialiser » supprime la clé et rend les attributs du système (D11) ;
  - `data-motion="reduit"` coupe l'oscillation de la flèche ; aucun débordement horizontal à 130 %, en police lisible
    et avec l'espacement du texte.
  Captures comparées à celles du handoff (`mobile-390_accessibilite_clair`, `desktop-1280_mosaique_sombre`) : en-tête,
  navigation, barre d'actions et panneau concordent, sauf le code de langue (voir « Décisions »).

## Non fait

- **Parcours Playwright `test/shell.e2e.ts`** : un composant de la coquille ne se rend que dans une page, et `app.vue` et
  `pages/` sont au lead (F3a). Les parcours navigateur (clavier réel, contraste, glissement) viendront avec l'intégration ;
  le contrôle en navigateur de ce lot est celui décrit plus haut, non reproductible dans le dépôt.
- **Glissement entre onglets** (SPEC § 3.1, 64 px, 340 ms) : c'est une animation des vues par onglet (F3-03, lead) ; `BottomNav`
  émet `select`, la page calcule le sens (voir la notice).
- **D18 sur le panneau** : `Popover` ne permet pas de séparer le nom accessible du titre visible (voir « Besoins partagés »).
- **Lien `NuxtLink` / navigation interne localisée** pour la déclaration : le panneau utilise `NuxtLink` vers l'adresse reçue,
  qui doit être déjà localisée (`localePath`).

## Notice d'intégration pour le lead (F3a)

### Ce qu'il faut appeler, une fois

`app.vue` (ou la coquille) appelle **une seule fois** `usePreferencesSync()` (import
`~/composables/shell/usePreferencesSync`). Au montage, il lit `matchMedia` (`prefers-color-scheme: dark`,
`prefers-reduced-motion: reduce`) et `localStorage` (`siteperso:preferences`), pose les attributs de `<html>` puis les tient
à jour ; il retire ses écouteurs au démontage ; il ne fait rien pendant le rendu serveur. Aucun autre composant n'écoute le
système. Tous les autres composants lisent le même état par `usePreferences()` (`useState('shell:preferences')`).

Attributs posés sur `<html>` (interface de `tokens.css`) :

| Attribut | Valeur posée | Retiré quand |
|---|---|---|
| `data-theme` | `sombre` ou `clair` | jamais (toujours posé) |
| `data-contrast` | `renforce` | contraste renforcé désactivé |
| `data-text-size` | `100`, `115` ou `130` | jamais (toujours posé) |
| `data-font` | `lisible` | police lisible désactivée |
| `data-spacing` | `augmente` | espacement désactivé |
| `data-links` | `soulignes` | soulignement désactivé |
| `data-motion` | `reduit` ou `normal` | jamais (toujours posé) |

Le script de thème sans flash (D5) doit lire la même clé et le même document : `localStorage['siteperso:preferences']`,
JSON `{ "version": 1, "theme", "textSize", "highContrast", "readableFont", "textSpacing", "underlineLinks", "reduceMotion" }`
(`domain/preferences.ts`), et poser les mêmes attributs. La table de correspondance est la fonction pure
`rootAttributes(preferences)` de `composables/shell/usePreferencesSync.ts` (elle peut devenir un module de `domain/` si le
lead veut en générer le script ; je n'y avais pas droit). Sans stockage, `data-theme` suit `prefers-color-scheme` et
`data-motion` suit `prefers-reduced-motion` (sombre et animations normales avant le montage, comme la maquette).

### Composants (imports explicites, ou `<ShellTopBar>`… par l'auto-enregistrement de Nuxt)

`SectionId` = `'profile' | 'experience' | 'recommendations' | 'ai'` (les `TileId` de `domain/layout`) ;
`SECTION_IDS`, `SECTION_FILES`, `SITE_HANDLE` dans `composables/shell/sections.ts`.

| Composant | Props | Événements | Remarque |
|---|---|---|---|
| `TopBar` (≥ 1024 px) | `active: SectionId \| null` (`null` : vue d'ensemble), `cvPath: string`, `declarationUrl: string` | `select(id)`, `overview()` | `<header>` ; fond et bordure sur toute la largeur, contenu aligné sur 1440 px ; 56 px |
| `MobileHeader` (< 1024 px) | `active: SectionId`, `declarationUrl: string` | aucun | `<header>` ; 52,5 px ; fichier selon `active` |
| `BottomNav` (< 1024 px) | `active: SectionId` | `select(id)` | `<nav aria-label="Sections">` ; 64 px |
| `ActionBar` (< 1024 px) | `hidden: boolean`, `cvPath: string` | aucun | se replie (hauteur animée `--dur-cta-bar`), `inert` quand masquée |
| `ScrollHint` | `visible: boolean` | `scroll()` | `position: absolute` : le parent doit être `position: relative` |
| `AccessibilityPanel`, `LanguageSwitch`, `ThemeToggle`, `ContactButton`, `CvButton` | `declarationUrl` ; aucune ; aucune ; `size?` ; `href`, `size?` | aucun | déjà inclus dans les barres, utilisables seuls |

### Ordre dans la page et câblage

Mobile et tablette (< 1024 px), de haut en bas : lien d'évitement, `MobileHeader`, `<main id="contenu">`
(`position: relative; flex: 1; min-height: 0; overflow: hidden`, qui contient la zone qui défile de l'onglet
et `ScrollHint`), `ActionBar`, `BottomNav`. Bureau : lien d'évitement, `TopBar`, `<main id="contenu">` (zone des tuiles).
**Un seul des deux jeux d'en-têtes dans le DOM** (`v-if` selon `computeLayout(...).mode`, pas un simple `display: none`) :
deux landmarks `banner` et deux panneaux d'accessibilité en double seraient exposés sinon.

```ts
usePreferencesSync(); // une fois
const tab = ref<SectionId>('profile');            // mobile et tablette
const scroller = ref<HTMLElement | null>(null);   // zone qui défile de l'onglet courant (ref de gabarit)
const { hidden } = useActionBar(scroller, tab);   // barre d'actions
const { more, scrollDown } = useScrollHint(scroller); // flèche
// <ActionBar :hidden="hidden" :cv-path="cvPath" />
// <ScrollHint :visible="more && !contactOuvert" @scroll="scrollDown" />
// <BottomNav :active="tab" @select="tab = $event" />
```

- `cvPath` : lien du CV PDF (il viendra de l'API en F4) ; `declarationUrl` : `localePath('/accessibilite')`.
- `useActionBar(scroller, resetKey, now?)` : `resetKey` est l'onglet courant (la barre revient quand il change) ;
  `scroller` doit pointer la zone qui défile de la section affichée (le watcher se réarme quand l'élément change).
- `useScrollHint(scroller)` : `more` est vrai tant que du contenu reste caché ; `scrollDown()` descend de 80 % de la
  hauteur visible, sans animation si « réduire les animations » est actif.
- **Glissement** : sens = `SECTION_IDS.indexOf(nouveau) > SECTION_IDS.indexOf(ancien)` → entrée par la droite (`translateX(64px)`
  → 0, `--slide-distance`), sinon par la gauche, 340 ms `cubic-bezier(.22, .8, .25, 1)`, sans animation sous mouvement
  réduit. Aucun `@keyframes` global n'existe : à poser dans `assets/css/` ou dans la vue par onglet.
- **Hauteur de la barre du haut** : 56 px, mais elle passe à la ligne (jusqu'à ~86 px) quand le texte agrandi ne tient plus
  entre 1024 et ~1150 px (WCAG 1.4.4/1.4.10) ; `zone.height` de `computeLayout` doit venir de la mesure réelle
  (`offsetHeight`), pas de 56.
- **`NUXT_PUBLIC_CONTACT_EMAIL` vide ou invalide** : `ContactButton` n'est pas rendu (un lien vide serait trompeur) ;
  le build statique devrait échouer dans ce cas (F4-04 / F9). L'adresse est validée (`[A-Za-z0-9._+-]@domaine.tld`, rien qui
  ouvre un paramètre du `mailto:`).
- **Tests de page** : `useState('shell:preferences')` est partagé et persiste d'un test à l'autre ; `clearNuxtState('shell:preferences')`
  (clé exportée : `PREFERENCES_STATE_KEY`) et `localStorage.clear()` en `beforeEach`.

## Décisions

- **D11 par un ajout, pas une modification** : le test existant de `resetPreferences` exige l'écriture des valeurs par
  défaut, que D11 contredit. Plutôt que de le toucher, j'ai ajouté `clearPreferences(storage)` (retire la clé, rend `cleared`,
  `unavailable` ou `error`, ne lève jamais) avec un sous-contrat `RemovablePreferencesStorage extends PreferencesStorage`
  (`removeItem`) : `PreferencesStorage` ne change pas, donc les tests existants (qui implémentent `getItem` et `setItem`) compilent
  toujours. `usePreferences().reset()` utilise `clearPreferences` ; **`resetPreferences` n'est plus appelée par l'application**
  (code conservé et couvert par ses tests existants, commenté comme tel). Le lead peut le supprimer avec son test sous
  `Justification-test` (un seul bloc de `preferences.spec.ts`).
- **État des préférences** : `useState` de Nuxt (partagé entre composants, sérialisé dans la page générée) plutôt qu'un
  `ref` de module ; l'effet de bord (système, stockage, `<html>`) est dans `usePreferencesSync`, appelé une fois, pour ne pas
  multiplier écouteurs et observateurs par composant. Tant que rien n'est enregistré, `followsSystem` reste vrai : le thème et
  les animations suivent les changements du système en direct (la limite notée en F2b est levée). Le moindre réglage enregistre
  les sept valeurs et cesse de suivre le système ; « Réinitialiser » rétablit le suivi.
- **`data-motion` toujours posé** (`reduit` ou `normal`) : `normal` est un choix explicite de garder les animations, y compris
  si le système demande de les réduire ; sans réglage, la valeur par défaut reprend `prefers-reduced-motion`.
- **Sélecteur de langue : code de la langue cible** (« EN » sur la page française, « FR » sur l'anglaise), nom accessible
  « English » / « Français » (lecture dans la langue cible, `lang` et `hreflang` sur le lien, étiquette incluse dans le nom,
  WCAG 2.5.3). La maquette affiche le code de la langue **courante** (« FR ») dans un bouton « Changer de langue, actuellement
  français » ; un lien qui affiche « FR » et mène à l'anglais est trompeur et rend `lang` incohérent. C'est un écart avec les
  captures (région de quelques pixels à comparer en F8-03), réglable en une ligne dans `LanguageSwitch.vue` (`target` → `locale`).
- **Bascule du thème** : nom « Thème sombre, passer en thème clair » (état puis action), plutôt que l'action seule de la
  maquette (« Passer en thème clair »).
- **`ContactButton` absent sans adresse valide** (voir la notice) plutôt qu'un lien `mailto:` sans destinataire.
- **Barre d'actions** : hauteur par `grid-template-rows` 1fr → 0fr (comme `Accordion`) au lieu de `height: 66px → 0` : elle suit
  son contenu quand le texte est agrandi (84 px à 130 % sans rogner les boutons) ; 66 px à 100 % comme la maquette (`min-height:
  var(--mobile-cta-bar)`). Masquée, elle est `visibility: hidden` après l'animation et `inert`.
- **Flèche « faire défiler »** : le composant n'affiche que `visible` ; la mesure et l'action sont dans `useScrollHint` (même
  logique que la maquette : mesure au défilement, au redimensionnement de la zone et de ses enfants, aux mutations du contenu et
  après `document.fonts.ready`).
- **`rootAttributes` dans le composable, pas dans `domain/`** : la permission de `domain/` du lot ne couvrait que D11 et
  `action-bar.ts`. La fonction est pure et testée ; son déplacement est trivial (voir la notice).
- **`SectionIcon` interne** : les quatre icônes de la barre du bas, décoratives (`aria-hidden`), nom donné par le libellé.
- **Annonce de la réinitialisation** : région `role="status"` masquée visuellement (« Réglages réinitialisés : le site suit de
  nouveau les préférences de votre système. »), vidée à la fermeture ; sans elle, « Réinitialiser » ne donnerait aucun retour à un
  lecteur d'écran. Clé `shell.accessibility.resetDone`.
- **Libellés** : `shell.nav.*`, `shell.sections.*`, `shell.actions.*`, `shell.language.*`, `shell.theme.*`,
  `shell.scrollHint.*`, `shell.accessibility.*` ; le nom de fichier `accessibilite.cfg` et le nom du site ne se traduisent pas.
- **Tests de composants** : un seul `defineComponent` par fichier (règle `vue/one-component-per-file`), une langue montée par test
  (la langue est globale à l'application de test : deux montages à routes différentes dans un test se contaminent), stockage
  remplacé par un objet qui enregistre ses appels (`Storage.prototype` n'est pas interceptable dans happy-dom : un premier jet
  de tests passait à vide, corrigé).

## Points ouverts

1. **Libellés anglais à relire par Julien** (UI, pas du contenu de seed) : « Recs » (Recos : « Recommendations » est trop long
   pour la barre du bas à 12 px), « Start the interview », « Getting in touch from your website » (sujet du `mailto:`),
   « Dark theme, switch to light theme », « Enhanced contrast ».
2. **Sujet du `mailto:`** : « Prise de contact depuis votre site » / « Getting in touch from your website », à valider.
3. **Code de langue affiché** (voir « Décisions ») : à confirmer ou à revenir au code courant de la maquette.
4. **`ContactButton` et attributs** : quand l'adresse est absente, le composant ne rend rien et Vue peut signaler en développement
   « Extraneous non-props attributes (class) » si la page lui passe une classe (c'est le cas de `ActionBar`). Sans conséquence en
   production ; inexistant dès que l'adresse est configurée (cas normal).
5. **Contraste des états `:hover` du `data-motion`/thème** : mesuré en navigateur sur les états repos et focus, pas sur le survol
   (axe ne le voit pas) ; les couleurs viennent des tokens déjà vérifiés par `tokens.spec.ts`.
6. **Lien `LinkButton` interne** (point 5 de F1b) : le CV et le `mailto:` n'en ont pas besoin ; la déclaration passe par `NuxtLink`.
7. **Tablette (768–1023)** : mêmes composants que le mobile ; contrôlée à 834 px en navigateur (en-tête 52,5 px, 0 violation axe) ;
   la colonne de 640 px est l'affaire de la page.

## Besoins partagés (à appliquer par le lead-architecte)

1. **D18, `Popover` (et `Window`)** : ajouter une prop `label?: string` qui pose `aria-label` sur l'élément `role="dialog"` et
   **retire alors `aria-labelledby`** (qui l'emporterait dans le calcul du nom), le titre visible (`>_ accessibilite.cfg`) restant
   dans l'`<h2>`. `AccessibilityPanel` n'aura plus qu'à passer `:label="t('shell.accessibility.panelLabel')"` : la clé
   « Réglages d'accessibilité » / « Accessibility settings » est déjà dans `shell.json`, inutilisée en attendant (à ne pas retirer).
2. **Typage du slot `trigger` de `Popover`** : les `props` rendus sont typés `string` (`aria-expanded`, `aria-haspopup`), ce qui
   oblige à `v-bind="trigger as ButtonHTMLAttributes"` dans le consommateur. Les typer `'true' | 'false'` et `'dialog'`
   (`as const`) supprimerait le cast.
3. **Glissement entre onglets** : `@keyframes` global (`slideInR`/`slideInL`, `--slide-distance`) dans `assets/css/`, ou dans la vue
   par onglet du lead.
4. **Script de thème D5** : lire `siteperso:preferences` (voir la notice) et poser les mêmes attributs ; envisager de passer
   `rootAttributes` dans `domain/` pour en générer le texte et le tester une fois.
5. **Hauteur de la barre du haut mesurée** pour `computeLayout` (voir la notice) et build qui échoue sans
   `NUXT_PUBLIC_CONTACT_EMAIL` valide.
6. **`resetPreferences`** de `domain/preferences.ts` : plus utilisée ; à supprimer avec son test sous `Justification-test` si le
   lead le souhaite.
7. **Clés communes** : aucune requise par ce lot. Le lien d'évitement (« Aller au contenu ») reste à porter par `common.json` (F3a).
8. Rappel de F1b non traité ici : `axe-core` en dépendance de développement du front (`axe.spec.ts` de `shell/` reprend la
   résolution par `@axe-core/playwright`).

## Vérifications

- `pnpm --filter @siteperso/web lint typecheck test:coverage` : sans erreur ni avertissement ; couverture 100 % sur les quatre
  métriques ; 555 tests unitaires et de composants du front.
- `pnpm --filter @siteperso/web test:mutation` : score 100,00, aucun survivant.
- `pnpm format` (rien à modifier) ; `pnpm integrity develop` : « Intégrité des tests : OK » (deux fichiers de test ajoutés dans
  `domain/`, aucun existant touché).
- `TURBO_FORCE=true pnpm check`, **code de sortie 0** (journal `check-f3b-2.log`, non commité) : hooks, intégrité, 12 tâches
  lint, typecheck, unitaires (API 430, contrats 220, front 555) et e2e (API 753, front 189 Playwright, inchangés : aucun parcours
  ajouté), puis 4 tâches de couverture, 100 % sur les quatre métriques (front 617/356/175/548, contrats 59/2/9/56, API inchangée).
  **Une première passe a échoué** (34 suites du projet `nuxt` en erreur `Failed to resolve import "#app-manifest"`) : `test` et
  `test:e2e` (`nuxt generate`) tournaient en parallèle dans le front et se disputaient le dossier de build de Nuxt
  (`node_modules/.cache/nuxt`, `.nuxt`). Course d'ordonnancement de Turborepo, sans lien avec le code du lot : la seconde passe,
  identique, est verte. À signaler au lead (F1 bis, cache et dossiers de build partagés) : une dépendance `test:e2e` → `test`, ou un
  dossier de build distinct pour `nuxt generate`, supprimerait l'aléa.
- `pnpm db:down` en fin de lot (ramène aussi le conteneur Playwright de ce worktree) ; arbre de travail propre.
