# Lot F5c : intégration des quatre sections dans la page (lead-architecte)

Date : 21 novembre 2026. Branche `lot/F5c-integration` (worktree `.claude/worktrees/lot-F5c-integration`), depuis
`develop` (b6b42d7). Isolation : `.env` racine `siteperso-v3-f5c`, 5952/5953, `PLAYWRIGHT_PORT=5954`,
`WEB_E2E_PORT=5955`. Règle D26 : ni `pnpm check` ni mutation complète ; vérifications ciblées. Rien dans `apps/api`,
`db`, `packages/contracts`. Aucun test existant modifié, aucune configuration protégée touchée. Journaux : dossier
temporaire de la session, préfixe `f5c-`.

## Résumé

Comme en F3a, **l'intégration elle-même n'est pas commitée** : elle rend faux 2 tests unitaires existants de
`HomePage.spec.ts` (contenu provisoire), et le hook pre-commit refuse alors tout commit. Est commité tout ce qui passe
sans elle (tokens, coquille, section Expérience) ; la bascule est dans
**`docs/comptes-rendus/lot-F5c-bascule.patch`** (`git apply --check` vérifié sur la tête de branche), à appliquer par
le correcteur avec la mise à jour des tests obsolètes listés plus bas (D23). Vérifiée appliquée : unitaires (seuls les
2 tests obsolètes échouent, couverture 100 %), parcours `experience`, `shell` et `sections` 707/707 aux 7 tailles, et
parmi les parcours existants seul `design-system.e2e.ts` « espacement du texte » devient obsolète (7 tailles).

## Fait

| Ticket | Livré | Où |
|---|---|---|
| Tokens | `--font-size-h3-tile` (1.375rem) dans `tokens.css` ; `--dur-egg-line` (350 ms) et `--dur-egg-bar` (1400 ms) dans `motion.css`, 0,01 ms sous mouvement réduit (réglage et système) ; `AiSection` et `EasterEggWindow` les utilisent, plus aucune valeur locale | commit, `section-tokens.spec.ts` |
| Titre | `h1` de la coquille toujours `.visually-hidden` ; le grand titre visible est `ProfileTitle` (balise `div`, défaut) : un seul `h1` (option (a) de F5a) | commit `AppShell.vue`, `AppShell-scrollers.spec.ts` ; parcours `sections.e2e.ts` |
| Section à défilement propre | prop `scrollers` d'`AppShell` (`Partial<Record<SectionId, HTMLElement \| null>>`) : pendant l'onglet d'une section qui a sa zone, `<main>` ne défile pas, n'a pas de marge ni d'arrêt de tabulation, la section remplit l'onglet ; `useActionBar` et `useScrollHint` lisent sa zone ; au bureau (avant F6), la section prend la hauteur de la fenêtre sous la barre du haut | commit `AppShell.vue` ; parcours `sections.e2e.ts`, `experience.e2e.ts` |
| Marges | onglets Recos et IA : 1.75rem (28 px) au-dessus du contenu, Profil et XP inchangés | commit `AppShell.vue` ; parcours |
| Section XP | `--experience-gutter` lu avec repli (`var(--experience-gutter, var(--tile-padding))`) au lieu d'être déclaré sur la racine : le parent peut le poser (une déclaration sur la racine l'emportait sur celle du parent) | commit `ExperienceSection.vue` |
| Intégration | `HomePage` : `ProfileSection`, `ExperienceSection` (ref → `scrollers.experience`, classe `home-page__experience` qui pose `--experience-gutter` = `--mobile-gutter` / `max(2rem, (100% - 40rem) / 2)` et `--experience-bg` = `--bg` sous 1024 px), `RecommendationsSection` (`source` = `links.linkedinRecommendations`), `AiSection` (`v-if="view.ai"`) ; libellés de `mapCv` inchangés (`experience.json`) ; clés `experience.provisional.*` et `recommendations.provisional.*` retirées (fr, en) | **patch** ; `HomePage-sections.spec.ts` (4 tests) |
| `?tech=` | conservé au changement d'onglet (sections toujours montées) et au changement de langue : `useSwitchLocalePath` de `@nuxtjs/i18n` 10.6.0 garde `query` et `hash` (`dist/runtime/routing/routing.js`, `switchLocalePath`) et suit la route ; aucun code à ajouter, prouvé par le parcours (lien `href` = `/en?tech=kafka` au chargement, puis `/en?tech=docker` après un choix, filtre appliqué après le clic) | parcours `sections.e2e.ts` |
| Parcours | `experience.e2e.ts` (patch F5b) appliqué ; nouveau `sections.e2e.ts` (12 tests × 7 tailles) : un seul `h1` masqué et titre visible du profil, `lang="fr"` des citations et légendes sur `/en`, liens externes `rel="noopener noreferrer"` (3 : LinkedIn du profil, lien du haut et bouton du bas des recos), aucun GitHub avec les fixtures, `?tech=` et sélecteur de langue, onglet XP (`<main>` `overflow: hidden`, marges 0, flèche et barre d'actions pilotées par la liste), marge haute 20/28 px | **patch** |

### Écart au patch F5b (à relire)

`experience.e2e.ts`, test « structure : filtre dans une zone fixe » : échouait sous 1024 px sur la vraie page
(`x: 20.465` puis `20`, `width: 349.99998` puis `350`) parce que la mesure de départ tombait pendant le glissement
d'onglet de la coquille (340 ms, `transform`), absent de l'intégration temporaire de F5b. Ajout, avant la mesure, d'une
attente de la fin des animations de la section (`getAnimations()` → `finished`), commenté ; l'assertion d'égalité
stricte est inchangée. Le fichier n'était pas encore dans le dépôt (c'est le patch F5b), mais c'est le test d'un autre
agent : la recette peut vouloir le vérifier. Les 33 autres tests du patch sont tels quels.

## Tests et parcours obsolètes (sortie honorable, D23)

Bascule appliquée, `pnpm exec vitest run app/components/home` : « Tests 2 failed | 7 passed ».

| Fichier : test | Exige | Faux parce que | Sortie |
|---|---|---|---|
| `app/components/home/HomePage.spec.ts` : « en français : h1 du titre du profil, contenu provisoire de chaque section » (l. 80-94) | accroches en `li` (l. 86), `#section-experience p` = « 8 expériences » (l. 91), `#section-recommendations p` = « 3 recommandations » (l. 92), `#section-ai p` = titre de l'IA (l. 93) | contenu provisoire de F3a : les accroches sont des `p` de `ProfileSection`, la section XP commence par le filtre, les recos par le lien source, le titre de l'IA est un `h3` | `expected [] to deeply equal [ …(2) ]` (l. 86) |
| même fichier : « en anglais : contenu de la fixture anglaise et libellés anglais » (l. 96-102) | « 8 experiences » (l. 100), « 3 recommendations » (l. 101) | idem | `expected 'filter by tech' to be '8 experiences'` |
| `test/design-system.e2e.ts:242` « espacement du texte (WCAG 1.4.12) » (7 tailles) | premier `main p` à `letter-spacing: normal` par défaut (l. 270) | le premier `main p` est maintenant une accroche du profil, `letter-spacing: -0.01em` de la maquette (`.profile__taglines`) | `- "normal" + "-0.16px"`. Démonstration que le réglage lui-même marche sur ce paragraphe : défaut `[-0.16px, 0px]`, rapports `[1.4, -0.01, 0]` ; `data-spacing="augmente"` → rapports `[1.5, 0.12, 0.16]` exactement (journal `f5c-captures.log`) |

Les assertions encore justes de ces tests (h1 « Développeur full-stack », pastille « senior », intro) sont reprises par
`HomePage-sections.spec.ts` ; le titre de page, le CV PDF et la section IA absente de l'API restent couverts par les
trois autres tests de `HomePage.spec.ts`, qui passent. Fixtures `app/data/fixtures/cv.{fr,en}.ts` : OpenClassrooms porte
encore « À distance » comme lieu (rendu « À distance, à distance », visible dans la capture desktop) alors que l'API
sert `null` depuis le lot back 17 (BF-12) : non modifié (fixture protégée), à corriger avec la bascule.

Ordre proposé au correcteur, en un commit : `git apply docs/comptes-rendus/lot-F5c-bascule.patch`, mise à jour des deux
tests de `HomePage.spec.ts` et du test d'espacement (prendre un paragraphe sans espacement de maquette, ou comparer au
défaut mesuré), puis la fixture OpenClassrooms.

## Décisions

- **Bascule en patch** (comme F3a) plutôt que commit sans hook (interdit) ou modification des tests (interdite) ; tout le
  reste est commité et testé seul.
- **`h1` masqué partout** (option (a) de F5a, recette F5a) : les styles de taille du `h1` de la coquille sont retirés
  (code mort une fois masqué) ; la classe `--other-tab` reste, sans style, parce qu'un test existant la vérifie
  (`AppShell.spec.ts`) — à retirer avec lui si le correcteur le juge utile.
- **Zone qui défile fournie par la page** (`scrollers`, clé présente = section à défilement propre) plutôt qu'un sélecteur
  `main:has(#section-experience…)` : la coquille ne connaît pas le DOM des sections, l'état est dans le composant (testé
  sans navigateur), et F6 pourra réutiliser la même donnée pour les tuiles. `<main>` passe à `tabindex="-1"` pendant cet
  onglet : il ne défile plus, la liste (`role="region"`, `tabindex="0"`) prend l'arrêt de tabulation ; le lien
  d'évitement le vise toujours (focus programmatique).
- **Bureau avant F6** : la section XP a `height: calc(100dvh - var(--desktop-header) - 1.5rem)` pour que seule sa liste
  défile (parcours « structure » et « fermeture du panneau » verts aux 4 tailles du bureau). Provisoire, remplacé par la
  tuile en F6.
- **Variables de la section XP posées par une classe de `HomePage`** sur la racine du composant (attribut transmis), après
  passage de `ExperienceSection` à la lecture avec repli : pas de dépendance d'ordre des feuilles de style.
- **Tokens** : la taille de titre dans `tokens.css` (avec les autres tailles, marquée « ajout F5c, hors
  design-tokens.json » ; `tokens.spec.ts` ne vérifie que les clés du handoff) ; les durées dans `motion.css`, à côté de
  `--dur-slide`, autre durée hors handoff.

## Vérifications (D26 : ciblées)

| Quoi | Commande | Résultat |
|---|---|---|
| Lint, typecheck (bascule appliquée) | `pnpm run lint`, `pnpm run typecheck` (apps/web) | codes 0 (`--max-warnings 0`) |
| Unitaires et couverture, bascule appliquée | `pnpm exec vitest run --coverage --coverage.reportOnFailure` (apps/web, `f5c-cov2.log`) | 992 réussis, **2 échecs = les 2 tests obsolètes** ; couverture **100 %** : 1162/1162 instructions, 660/660 branches, 380/380 fonctions, 1038/1038 lignes |
| Unitaires et couverture, tête de branche | hook pre-commit à chaque commit ; `pnpm --filter @siteperso/web test:coverage` (`f5c-cov3.log`) | code 0 : 95 fichiers, 990 tests ; **100 %** : 1161/1161, 658/658, 381/381, 1038/1038 |
| Parcours concernés, bascule appliquée | `playwright test test/experience.e2e.ts test/shell.e2e.ts test/sections.e2e.ts` (`f5c-e2e3.log`) | **707/707** (476 + 147 + 84) aux 7 tailles, fr et en ; dont « zone fixe » et « fermeture du panneau au défilement », inconclusifs en recette F5b |
| Parcours existants touchés par le titre et le contenu | `playwright test test/smoke.e2e.ts test/design-system.e2e.ts test/controls.e2e.ts` puis `boot`, `cv` | 245 réussis, **7 échecs = « espacement du texte »** (obsolète, ci-dessus) ; `boot` + `cv` 63/63 |
| Intégrité | `pnpm integrity develop` | « HEAD comparé à develop (point de divergence b6b42d712150) », « Intégrité des tests : OK » |
| Mutation | sans objet | aucun fichier de `domain/` ni de `data/` touché |

Captures pour Julien (hors dépôt, fixtures, mouvement réduit) :
`/tmp/claude-1000/-home-jlachaux-IA-PROJECTS-site-perso-personnalWebsite-V3/adc7d6bb-d6ca-4961-bd2a-09cd85b57ef1/scratchpad/f5c-captures/`
— `mobile-390_fr_{profil,xp,recos,ia}_sombre.png`, `mobile-390_fr_xp-deux-filtres_sombre.png` (URL
`/?tech=typescript,docker`), `mobile-390_fr_easter-egg_sombre.png`, `desktop-1280_fr_clair.png` (+ `_page-entiere`).
Prises par un parcours temporaire `test/f5c-captures.e2e.ts`, supprimé ensuite (un script Node direct a été refusé
par les garde-fous : « écriture opaque (node) qui mentionne un oracle (apps/web) » ; non contourné).

## Points ouverts pour F6 (mosaïque)

1. **Tuile XP** : `<BaseTile … :scrollable="false">` ; la tuile doit avoir une hauteur définie. Retirer alors la règle
   provisoire `.app-shell__section--self-scrolling { height: calc(100dvh - …) }` du bureau ; garder `scrollers` (la tuile
   agrandie peut aussi vouloir la flèche). En tuile, laisser `--experience-gutter` et `--experience-bg` à leurs défauts
   (`--tile-padding`, `--card`).
2. **Double marge au bureau** : aujourd'hui la section de la coquille (1.25rem) plus la marge de la section XP (24 px) ;
   la tuile n'aura que la seconde.
3. **Barre du haut à 1024 px en anglais** : 73 px au lieu de 56 (`--desktop-header`), le bouton « CV PDF (in French) »
   la fait passer à la ligne (mesuré par le parcours : section XP à 785 px de bas pour une fenêtre de 768). La hauteur
   de la mosaïque (`computeLayout`) devra mesurer la barre réelle, pas le token.
4. **Titre du profil** : `ProfileSection` reste en `titleTag="div"` ; si F6 fait de la tuile Profil agrandie un
   contexte autonome, le `h1` masqué de la coquille suffit toujours (un seul `h1`).
5. **Rappels F5a/F5b non tranchés ici** : titre de l'IA en une couleur (contrat), opacité 0,9 des cartes atténuées (D24,
   à confirmer par Julien), étiquette du filtre en `aria-labelledby` (D25), traductions EN de `experience.json` à relire.
6. **Test instable sous charge** : `ChipInput.spec.ts` « retire une puce au clic » a échoué une fois dans une passe
   complète (`expected undefined to deeply equal [['docker']]`), vert seul ; même famille que les délais relevés en
   recettes F5a et F5b.
