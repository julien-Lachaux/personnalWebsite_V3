# Lot F5b : section Expérience, filtre par techno et easter egg (dev-front)

Date : 20 novembre 2026. Branche `lot/F5b-experiences` (worktree `.claude/worktrees/lot-F5b-experiences`), depuis
`develop` (b3ca884). Isolation : `COMPOSE_PROJECT_NAME=siteperso-v3-f5b`, ports 5942 à 5945. Périmètre écrit respecté :
`app/components/experience/`, `app/composables/experience/`, `i18n/locales/{fr,en}/experience.json`, leurs tests, et ce
compte rendu. Rien dans `components/home/`, `components/shell/`, `components/base/`, `data/`, `domain/`, `pages/`,
`nuxt.config.ts`, `assets/css/`, `common.json`. Aucun test existant modifié. Aucun fichier de `domain/` ni de `data/`
ajouté : pas de mutation à mesurer (`filter.ts` et `format.ts` utilisés tels quels, aucun manque).

## Résumé

Tout le périmètre est livré et testé, **sauf** le parcours Playwright `test/experience.e2e.ts` : la section n'est montée
par aucune page tant que le lead ne l'a pas intégrée (`pages/` et `components/home/` interdits), un parcours committé
échouerait donc dans `pnpm check`. Sortie prévue par le brief : le parcours est écrit, **vérifié sur une intégration
temporaire** (476 réussis aux 7 tailles, fr et en) et livré dans `docs/comptes-rendus/lot-F5b-parcours.patch`
(`git apply` crée `apps/web/test/experience.e2e.ts`), à appliquer après l'intégration (notice ci-dessous). La page de
démonstration temporaire (modification de `HomePage.vue` et styles de hauteur) est retirée, rien n'en reste.

## Fait

| Ticket | Livré | Fichiers |
|---|---|---|
| **TechFilter** | zone fixe : étiquette « filtrer par techno », `ChipInput` (puces retirables, saisie, Entrée = première suggestion valide, Retour arrière sur champ vide retire la dernière, « Effacer »), `SuggestionList` (6 au plus, compteur), `FilterDrawer` (glissement + fondu `--dur-drawer` 280 ms, « stack principale », « Toutes les technos (N) » par domaine, compteurs dynamiques, techno à 0 en `aria-disabled`, sans XP en pointillé non cliquable), région `aria-live` ; ouverture au clic ou au focus (pas au focus programmatique), choisir ne ferme pas, fermeture par Fermer, Échap, défilement de la liste | `TechFilter`, `ChipInput`, `SuggestionList`, `FilterDrawer`, `AllTechs`, `TechOption` |
| **Résultats** | `ResultGroups` : « Avec toutes ces technos · N » (« Avec X · N » pour une seule techno, comme la maquette), « Voir / Masquer les N autres expériences » (pluriels), autres atténuées avec « En partie : X », état vide « Aucune expérience ne combine toutes ces technos » + bouton | `ResultGroups` |
| **ExperienceCard** | intitulé (`h3`), organisation (`@` ou `›` caché des lecteurs d'écran), période (mono, violet), lieu · mode · contrat, résumé, détail en `Accordion` de base (`aria-expanded`/`aria-controls`, 320 ms), puces `TechChip` qui basculent le filtre, séparateur sous la carte ; « Huile de coude » ouvre l'easter egg | `ExperienceCard`, `CardHeader`, `CardIntro`, `CardStack` |
| **EasterEggWindow** | `Window` modale `huile-de-coude.sh`, nom accessible « Huile de coude » / « Elbow grease » (D18), sept lignes animées une à une en CSS, barre de progression, « Retour au CV », retour du focus sur la puce | `EasterEggWindow` |
| **URL** | `?tech=slug1,slug2` : lu au montage, écrit par `router.replace` sans recharger, autres paramètres et ancre conservés, suit les changements d'URL ; survit au changement d'onglet (les sections restent montées, l'URL garde le paramètre) | `composables/experience/useTechFilter.ts` |
| **Section** | `ExperienceSection` : filtre en zone fixe, liste nommée (`role="region"`, `tabindex="0"`) qui défile seule, un clic sur une puce de carte remonte la liste, défiler ferme le panneau | `ExperienceSection` |
| **Libellés** | `experience.json` fr/en : ceux attendus par `mapCv` (`present`, `breakOrganisation`, `workMode.*`, `contractType.*`, déjà là depuis F3a) + filtre, suggestions, panneau, résultats, cartes, easter egg ; `provisional.count` conservé (utilisé par `HomePage` tant que la section n'est pas intégrée) | `i18n/locales/{fr,en}/experience.json` |

## API publique

Composants importés explicitement (`~/components/experience/…`), aucun auto-import de sous-dossier utilisé.

- `ExperienceSection` : props `experiences: readonly ExperienceView[]`, `techs: TechsView` (`view.experiences`,
  `view.techs` de `mapCv`) ; expose `scroller` (l'élément de la liste, pour la barre d'actions et la flèche de défilement
  de la coquille). Variables CSS : `--experience-gutter` (marges latérales, défaut `var(--tile-padding)`),
  `--experience-bg` (couleur du fondu du bas de liste, défaut `var(--card)`).
- `TechFilter` : props `techs`, `experiences`, `v-model:selected` (slugs) ; expose `closeOnScroll()`.
- `ChipInput`, `SuggestionList`, `FilterDrawer`, `AllTechs`, `TechOption`, `ResultGroups`, `ExperienceCard`,
  `CardHeader`, `CardIntro`, `CardStack`, `EasterEggWindow` (`v-model:open`, `returnFocusTo`) : internes à la section.
- `useTechFilter(knownSlugs)` → `{ selected }` (`WritableComputedRef<readonly string[]>`, écrire met l'URL à jour).

## Notice d'intégration pour le lead

1. **`HomePage.vue`** (slot `experience`) :

   ```vue
   import ExperienceSection from '../experience/ExperienceSection.vue';
   <template #experience>
     <ExperienceSection :experiences="view.experiences" :techs="view.techs" />
   </template>
   ```

   `mapCv` reçoit déjà les libellés (`present`, `breakOrganisation`, `workMode`, `contractType`). Ensuite,
   `experience.provisional.count` n'est plus utilisée (la retirer de `experience.json` avec ses deux clés).
   **Tests obsolètes (sortie honorable, à faire corriger)** : `components/home/HomePage.spec.ts` lignes 91 et 100
   (`#section-experience p` = « 8 expériences » / « 8 experiences ») ne décrivent plus la page.
2. **Hauteur** : la racine de la section prend la hauteur de son parent (`height: 100%`, ou `flex: 1` dans un parent flex
   en colonne) ; ce parent doit avoir une hauteur définie et **ne pas défiler** (seule la liste défile).
   - Mosaïque (F6) : `<BaseTile … :scrollable="false">` ; le corps de la tuile suffit.
   - Onglets (< 1024 px) : pendant l'onglet XP, `<main>` ne défile pas et n'a pas de marge (la zone fixe est à bord
     perdu, comme la maquette) : par exemple `main:has(#section-experience.app-shell__section--current)` en
     `overflow: hidden; padding: 0; display: flex; flex-direction: column` et `#section-experience` en
     `display: flex; flex: 1; min-height: 0` (le `h2` masqué et le `h1` restent dans le flux). Poser sur la section
     `--experience-gutter: var(--mobile-gutter)` (tablette : `max(2rem, (100% - 40rem) / 2)`) et
     `--experience-bg: var(--bg)`.
   - `useActionBar` et `useScrollHint` lisent `<main>` : pour l'onglet XP, leur donner `ExperienceSection.scroller`
     (ref du composant) ou `#section-experience .experience-section__list`.
3. **Sélecteur de langue** : garder `?tech=` en passant de `/` à `/en` (les slugs sont les mêmes dans les deux langues).
4. **Parcours Playwright** : après l'intégration, `git apply docs/comptes-rendus/lot-F5b-parcours.patch`
   (`apps/web/test/experience.e2e.ts`, 34 tests × 7 tailles). Il lit la section par `#section-experience` ; sous 1024 px
   il clique l'onglet XP. Vérifié ici avec une intégration temporaire (conteneur de hauteur fixe, marges de l'onglet
   annulées) : 476/476. Si la mise en page du lead change la géométrie, seuls le test « structure » (zone fixe) et le
   test « cibles » en dépendent.
5. CSP (F9) : la section n'ajoute ni script ni attribut `style` au HTML généré (la fenêtre n'est rendue que côté
   navigateur, ses `--line-delay` passent par le CSSOM) ; seuls des `<style>` de composants.

## Décisions

- **Hydratation** : la page est générée sans filtre ; `useTechFilter` lit l'URL après le montage (`onMounted`), donc le
  premier rendu du navigateur est identique au HTML statique (pas d'écart d'hydratation, vérifié par un test sur la
  première valeur rendue). L'état local est la source immédiate (la navigation de vue-router est asynchrone : deux clics
  rapprochés ne lisent pas un état périmé), l'URL le suit, et suit l'URL en retour (retour du navigateur, lien collé).
- **`router.replace`**, pas `push` : une puce choisie n'est pas une page de l'historique (test qui échoue avec `push`).
- **Champ nommé par `aria-labelledby`**, pas par `<label for>` : la règle `vuejs-accessibility/label-has-for` exige
  l'imbrication du champ dans le `label` ET un `for`, ce que le champ (composant `ChipInput`, hors du `label`) ne peut
  pas faire sans désactiver la règle (configuration de lint protégée). Contre-partie : cliquer le texte de l'étiquette ne
  donne pas le focus au champ.
- **Pas de motif combobox** : le champ est un `input type="text"` avec `aria-controls` (panneau, ou suggestions pendant
  la saisie) ; `aria-expanded` n'est pas valide sur ce rôle. Les suggestions et le panneau sont des boutons dans l'ordre
  de tabulation (le panneau fermé est `inert`).
- **Noms accessibles qui reprennent le texte visible** (axe `label-content-name-mismatch`, WCAG 2.5.3, relevé par le
  parcours Playwright et corrigé) : « NestJS, 1 expérience », « Node.js, 0 expérience avec les filtres en cours »,
  suggestions « Ajouter TypeScript, 2 XP ». Le compteur d'une `TechOption` est écrit dans le slot après une espace
  (« NestJS 1 ») et non par la prop `count` de `TechChip` (qui colle « NestJS1 » dans le texte du DOM).
- **Atténuation des cartes « autres » : 0,9 d'opacité et texte en `--muted`**, pas 0,6 comme la maquette : à 0,6 le texte
  atténué du thème clair tombe à 2,8:1 (calcul sur `--muted` #4f5b5e sur blanc), sous les 4,5:1 de la SPEC § 10.2 ; sur le
  fond de page du mobile (`--bg`, plus sombre que `--card`) 0,88 donnait encore 4,48:1 (mesure axe). À 0,9, avec les
  textes en `--muted`, axe ne relève rien dans les quatre palettes à toutes les tailles.
- **Autres expériences : correspondances partielles d'abord**, puis celles sans aucune techno choisie, chaque groupe dans
  l'ordre d'origine (la maquette ne remplit jamais « en partie », la SPEC le demande : la SPEC gagne, F2a).
- **Titre du groupe** : « Avec X · N » pour une seule techno (maquette), « Avec toutes ces technos · N » au-delà.
- **Annonce `aria-live`** : « N expériences affichées » sans filtre (la maquette n'annonce rien), « N expériences avec toutes
  les technos choisies », « Aucune expérience ne combine toutes ces technos ». Le texte initial est dans le HTML statique :
  il n'est pas annoncé au chargement.
- **Focus** : le champ garde un contour de focus de 2 px accent porté par son cadre (`:has(…:focus-visible)`), pas un
  rectangle dans le rectangle ; le retour de focus après une action utilise un drapeau synchrone (`focusQuietly`), pas le
  délai de 500 ms de la maquette. L'ouverture sur défilement garde la tolérance de 450 ms de la maquette (l'ouverture du
  panneau peut faire défiler la liste).
- **Échap** : un seul écouteur sur la zone du filtre (retiré au démontage) : vide la saisie, sinon ferme le panneau, depuis
  le champ, les suggestions ou le panneau ; sans effet (non intercepté) quand rien n'est ouvert.
- **Animation de l'easter egg en CSS** : chaque ligne a un délai (`--line-delay`), mis à zéro par `--egg-delay-scale: 0`
  sous mouvement réduit (`prefers-reduced-motion`, ou réglage « réduire », sauf `data-motion="normal"`) ; les durées de
  0,01 ms viennent du filet de `base.css`. Un `:global(...) .egg` dans un style scopé de Vue perd le `.egg` à la
  compilation (la variable se posait sur `<html>`, masquée par la valeur par défaut) : c'est un bloc `<style>` non scopé
  qui la pose (trouvé par le parcours Playwright sous mouvement réduit, invisible en test unitaire).
- **Durées de l'easter egg** (350 ms, 1,4 s, délais de la maquette) en variables locales du composant : aucun token
  `--dur-*` ne les couvre (voir « Demandes »).

## Non fait

- `test/experience.e2e.ts` committé (voir « Résumé » : livré en patch).
- Fenêtre « Lancer l'entretien », mosaïque, autres sections : hors périmètre.

## Points ouverts

1. **Atténuation de la maquette (0,6) incompatible avec la SPEC § 10.2** : démonstration ci-dessus ; 0,9 + `--muted`
   retenu. À confirmer par Julien.
2. **« À distance, à distance »** (écart 1 de F4) : OpenClassrooms affiche « À distance, à distance » (`location` et
   `workMode` disent la même chose) ; visible dans la carte, à décider (seed ou règle d'affichage).
3. **Étiquette non cliquable** (décision `aria-labelledby`) : si Julien tient à `<label for>`, il faut assouplir la règle
   `label-has-for` (config de lint, lead).
4. **« Effacer »** : nom accessible « Effacer tous les filtres » (le texte visible « Effacer » y est contenu).
5. **Traductions EN à relire** (ajoutées dans `en/experience.json`) : tout `filter.*`, `suggestions.*`, `drawer.*`,
   `tech.*`, `results.*`, `card.*`, `easterEgg.*` ; en particulier les lignes du terminal (« 1 package added, 0
   dependencies, in 21 months », « build real-estate-project », « Done. 0 vulnerabilities (except the back). ») et le
   nom « Elbow grease » (déjà celui de la puce, servi par l'API).
6. **Ouvert au focus** : un lecteur d'écran qui parcourt par Tab ouvre le panneau en arrivant dans le champ (comportement
   demandé par la SPEC) ; le panneau fermé est `inert`, donc pas de piège.

## Demandes de changement partagé

- **Token de durée** pour l'animation des lignes de l'easter egg (`--dur-egg-line` 350 ms, `--dur-egg-bar` 1400 ms) dans
  `assets/css/tokens.css`, avec leurs valeurs réduites : à défaut, les variables locales du composant tiennent (le filet
  de `base.css` coupe déjà toute durée d'animation).
- Intégration décrite dans la notice (HomePage, mise en page de l'onglet XP et de la tuile, sélecteur de langue,
  `useActionBar`/`useScrollHint`), puis `git apply` du parcours Playwright.

## Vérifications

- Tests de composants et du composable : 11 fichiers, 148 tests (`mountSuspended`, fr et en) : rendu, clavier complet du
  filtre (Tab, focus, saisie, Entrée, Retour arrière, Échap, Fermer, défilement, focus programmatique), ARIA, URL,
  groupes, accordéon, easter egg (nom, focus, lignes, délais, Échap, voile, retour du focus), noms accessibles contenant le
  texte visible. axe (WCAG 2.2 AA) sur la section montée seule : repos, panneau ouvert, panneau déplié, suggestions,
  saisie sans résultat, état vide, autres dépliées, accordéon ouvert, fenêtre ouverte ; fr et en ; avec un témoin qui prouve
  que l'outil détecte une violation.
- **Sonde de mutation manuelle** des composants (hors Stryker, qui ne couvre que `domain/` et `data/`) : 29 mutations
  (délai de grâce, rendu du focus, inert, ordre des groupes, retrait de la puce, `replace`/`push`, ancre, délais de l'easter
  egg…) ; 2 survivants au premier passage (une assertion faite avant le rendu, une assertion vide de sens), corrigés :
  29/29 tuées.
- Parcours Playwright (patch) sur intégration temporaire : `playwright test test/experience.e2e.ts` : **476 réussis**
  (34 tests × 7 tailles × fr et en), dont axe WCAG 2.2 AA dans les quatre palettes (règle `color-contrast` exécutée),
  mouvement réduit, cibles de 44 px, focus visible. Ont trouvé (puis fait corriger) : noms accessibles ne contenant pas le
  texte visible, contraste des cartes atténuées, variable de mouvement réduit de l'easter egg. Captures comparées aux
  références (`mobile-390_xp-filtres_clair`, `mobile-390_xp-tiroir_sombre`, `mobile-390_easter-egg_sombre`,
  `desktop-1280_xp-filtres-tiroir_sombre`, `desktop-1280_xp-filtres-sans-resultat_clair`) : mêmes styles.
- `pnpm integrity develop` : « Intégrité des tests : OK ». `TURBO_FORCE=true pnpm check` (journal `f5b-check.log`, hors
  dépôt) : **code 0** : lint, typecheck, unitaires front 906 (79 fichiers), e2e front 448 (parcours existants, inchangés),
  couverture front 100 % sur les quatre métriques (1088/1088 instructions, 620/620 branches, 361/361 fonctions, 972/972
  lignes), API et contrats inchangés.
- `pnpm db:down` en fin de lot ; navigateurs et serveurs arrêtés.
