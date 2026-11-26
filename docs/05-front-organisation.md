# Organisation du front V3 : lots, agents, coordination avec le back

Proposition du 19 novembre 2026, validée par Julien le même jour (décisions D1 à D8 comprises). Sources : handoff v6
(`/home/jlachaux/IA_PROJECTS/site-perso/front-handoff-v6/`, `SPEC.md` fait foi), `docs/02`
(stack front), `docs/04-front-donnees.md` (données). Même méthode que le back : un lot = une
branche `lot/F<N>-nom` + un worktree, un agent du dépôt qui livre, recette du chef-de-projet,
fusion `--no-ff` dans `develop` par la session front.

## Décisions (validées le 19 novembre 2026)

| # | Sujet | Proposition |
|---|---|---|
| D1 | Version de Nuxt | `docs/02` dit Nuxt 3 ; la règle « dernière majeure » donne **Nuxt 4.6.4** (`pnpm view nuxt version`, 19 nov. 2026), `@nuxtjs/i18n` 10.6.0. Proposition : Nuxt 4, et mise à jour de `docs/02`. |
| D2 | Rendu | Génération statique (`nuxt generate`) à partir de `GET /cv` pour fr et en, comme `docs/02` ; aucun serveur Node du front en production. |
| D3 | Couverture et mutation | Même règle que le back sur `apps/web/app` : 100 % (Vitest unitaires + composants), aucune exclusion ; mutation Stryker sur `domain/` et `data/`. Les parcours Playwright ne comptent pas dans la couverture. |
| D4 | Accessibilité | WCAG **2.2** AA (spec du handoff ; inclut le 2.1 AA de `docs/02`), axe dans les e2e sur chaque section, deux thèmes et contraste renforcé. |
| D5 | Thème sans flash | Petit script en tête de page qui pose `data-theme` et les réglages depuis localStorage avant l'affichage, autorisé par empreinte dans la CSP. Pas de cookie (rendu statique). |
| D6 | Polices | Auto-hébergées (Space Grotesk, JetBrains Mono, Atkinson Hyperlegible, licences OFL) : CSP stricte, rien vers Google. |
| D7 | Captures de référence | Le handoff entre dans le dépôt sous `apps/web/design/handoff-v6/` (sans les `.dc.html` si on veut alléger) : les tests de régression visuelle et la recette depuis un clone en ont besoin. |
| D8 | Statistiques | Aucune pour l'instant. |

### Décisions du 20 novembre 2026 (recettes F0, F1, F2)

| # | Sujet | Décision |
|---|---|---|
| D9 | Profil en mosaïque 2 colonnes | Pleine hauteur (maquette portable, SPEC § 3.3) ; hauteur de contenu en 3 colonnes. |
| D10 | Poussée des tuiles | La poussée « par le haut » de la maquette complète la SPEC § 4.2 (gauche, droite, bas, haut). |
| D11 | « Réinitialiser » les préférences | Supprime le réglage enregistré : le site suit de nouveau le système (stockage avec suppression). |
| D12 | Bordures des contrôles en thème sombre | Bordure dédiée `#66798A` (≥ 3:1) pour les contrôles soumis à WCAG 1.4.11 (champs, interrupteurs, puces, cadres) ; le `line` décoratif du handoff reste inchangé. |
| D13 | Cache Turborepo partagé entre worktrees | Corrigé dans un mini-lot du lead (F1 bis) ; d'ici là les recettes tournent avec `TURBO_FORCE=true`. |
| D14 | Mutation des composants | Non pour l'instant : la mutation reste sur `domain/` et `data/`. |
| D15 | `/fr` | Redirige vers `/` (F3). |
| D16 | Défauts du script d'intégrité (noms accentués, motif `includes`) | Brief à la session back (`docs/briefs/back-002-integrite.md`). |
| D17 | Puces de techno sur mobile et tablette | 28 px de haut comme la maquette (WCAG 2.2 AA demande 24 px) au lieu de 44 px. |
| D19 | Sélecteur de langue | ~~Langue courante seule~~ remplacé par D21. |
| D21 | Sélecteur de langue (20 nov., remplace D19) | Modèle GOV.UK : « FR \| EN » visibles ; la langue courante n'est pas un lien et porte `aria-current="true"` ; l'autre est un lien dont le texte visible est le nom accessible (WCAG 2.5.3, commande vocale), avec `lang` et `hreflang` de la cible. |
| D22 | CV PDF (20 nov.) | Le PDF fourni par Julien est versionné tel quel dans `apps/web/public/cv/` (métadonnées nettoyées, SPEC § 11) : son e-mail et son téléphone y figurent, exception explicite de Julien à la règle « aucun e-mail ni téléphone dans le dépôt » de CLAUDE.md, limitée à ce fichier. Source hors dépôt : `../front-assets/cv-fr.pdf`. |
| D23 | Tests rendus obsolètes par une décision de Julien (21 nov.) | Pas de triage : le correcteur les met à jour (ou les retire si un autre test couvre le nouveau comportement) sous autorisation « tests », prouve chaque modification test par test, et la recette vérifie qu'aucun n'est affaibli. Le triage reste obligatoire pour tout autre test contesté. |
| D24 | Cartes « autres expériences » (21 nov.) | Opacité 0,9 et texte `--muted` au lieu de 0,6 (maquette) : contraste ≥ 4,5:1 dans les quatre palettes. |
| D25 | Étiquette du champ de filtre (21 nov.) | Nom accessible par `aria-labelledby` (clic sur l'étiquette sans focus) : tranché par la revue d'accessibilité en F10. |
| D26 | Une seule vérification complète par lot (21 nov., priorité : machine saturée) | Les agents de développement et le correcteur ne lancent pas `pnpm check` ni la mutation complète : vérifications ciblées seulement (lint, typecheck, `test:coverage` du paquet, parcours Playwright des fichiers touchés, mutation des fichiers `domain/`/`data/` touchés, `pnpm integrity`). La recette lance l'unique `pnpm check` complet du lot, sur la branche déjà à jour de `develop`, après accord de l'autre session (une seule vérification complète à la fois sur la machine). Pas de nouveau `check` à la fusion si `develop` n'a pas bougé depuis la recette ; la CI reste le filet final. Précisé le 21 nov. : la CI de la PR est l'unique vérification complète ; la recette la lit et fait des contrôles ciblés. |
| D27 | Section IA vide (21 nov.) | Quand l'API ne sert pas de section IA, la tuile et l'onglet IA affichent un placeholder (petit terminal, picto décoratif) au lieu d'une zone vide. |
| D28 | Texte du placeholder IA (22 nov.) | Pour l'instant, le placeholder affiche seulement « placeholder » (identique en fr et en), en attendant le contenu de Julien. |
| D29 | En-tête mobile à 130 % (23 nov.) | L'ellipse du nom de fichier de l'en-tête mobile (`julien-lachaux/<fichier>`) est voulue (SPEC § 3.1) et gardée, même quand le texte agrandi la déclenche (BUG-F2 de la QA F8 écarté). **À vérifier explicitement en revue finale (F10, revue-a11y)** : lisibilité de l'information tronquée à 130 % et 200 %. |
| D30 | Matrice d'accessibilité dans la CI (23 nov.) | La matrice F8 (7 tailles × 2 langues × 4 palettes × texte 100/130 %, axe WCAG 2.2 AA, ~10 min) tourne dans la CI de chaque PR ; à revoir plus tard si la CI devient trop lente. |
| D31 | Adresse de contact en clair (23 nov., RS-2 de la revue F10) | Le bouton « Lancer l'entretien » est un `mailto:` : l'adresse est forcément en clair dans le HTML, écart accepté à SPEC § 11. En production, `NUXT_PUBLIC_CONTACT_EMAIL` vaut un alias Gmail « plus » de la boîte de Julien (`<identifiant>+contact@gmail.com`, précision de Julien du 23 nov.), posé seulement dans la configuration de production ; le dépôt garde le placeholder `contact@example.org` et ne contient jamais l'adresse réelle. |
| D32 | Nom des liens de langue (23 nov., RA-8 de la revue F10) | Les liens du sélecteur gardent pour nom accessible « FR » et « EN » seuls, comme le prévoit D21 ; pas de texte masqué complémentaire. |
| D33 | CV PDF non balisé (23 nov., RA-10 de la revue F10) | `cv-fr.pdf` reste tel quel pour l'instant ; la déclaration d'accessibilité le mentionne comme contenu non accessible (alternative : la page web), mention retirée quand Julien fournira un PDF balisé. Le même CV français sert aux deux langues jusqu'au CV anglais (lien « in French »). Les deux suites sont dans `docs/front-a-traiter-par-julien.md`. |
| D34 | Déclaration d'accessibilité (23 nov., revue F10) | La rubrique « Contenus non accessibles » de `/accessibilite` (fr et en) liste tous les défauts connus non corrigés à la publication (au minimum le CV PDF, D33), au lieu de « Aucun défaut recensé » ; elle est tenue à jour à chaque correction. |
| D35 | État pressé des puces de techno (23 nov., RA-7 de la revue F10) | Une puce sélectionnée (`aria-pressed="true"`) porte une coche ✓ devant son nom, décorative (`aria-hidden`), dans tous les thèmes : l'état ne repose plus sur la seule couleur (WCAG 1.4.1). Écart voulu au handoff. |
| D36 | Code mort des préférences (23 nov., RC-3 de la revue F10) | `resetPreferences`, son bloc de test et les réexports de `usePreferencesSync.ts` qui ne servent qu'à ce test sont supprimés, comme tests rendus obsolètes (D23, `Justification-test: RC-3`). Un futur bouton « Réinitialiser » réécrira la fonction avec ses tests. |
| D37 | Imports du domaine dans les composants (23 nov., RC-4 de la revue F10) | Un composant peut importer les fonctions pures de `app/domain/` (testées et mutées à 100 %) ; il n'importe rien de `app/data/`, sauf `components/home/HomePage.vue` (`mapCv`, avec `useCv`). La logique propre au composant reste couverte à 100 % par ses tests de composant, hors mutation. Règle verrouillée par `app/architecture-components.spec.ts` (projet Vitest `nuxt`). |
| D38 | Langue du mot « placeholder » (23 nov., revue F10) | Le texte provisoire de D28 reste sans `lang="en"` sur la page française (écart WCAG 3.1.2 accepté) : il n'apparaît que si la section IA est vide, ce qui n'est pas le cas en production ; à revoir avec le texte définitif. |
| D39 | Fermeture du panneau superposé (23 nov., RA-5 de la revue F10) | `Popover` se ferme quand le focus quitte sa racine (sans reprendre le focus), pour que le focus ne passe jamais sous le panneau (WCAG 2.4.11) ; Échap reste actif. Le test « non modal : reste ouvert quand le focus sort » (`Popover.spec.ts`) est rendu obsolète par cette décision et mis à jour sous D23 (`Justification-test: RA-5`). |
| D40 | Politique CSP du test (23 nov., RC-8 et RS-5 de la revue F10) | En F11 : `apps/web/test/csp.e2e.ts` importe la politique de `scripts/deploy/csp-hashes.mjs` au lieu d'en garder une copie (modification d'un test existant décidée par Julien, `Justification-test: RC-8`), après le brief back qui exporte la fonction et resserre `img-src` à `'self'` (RS-5). |
| D41 | Profil lisible dans la mosaïque (25 nov., retours d'installation, lot F12) | Le Profil n'est plus réduit d'un facteur S dans la mosaïque (écart voulu à SPEC § 4.1) : il garde la taille de texte normale et défile comme les autres tuiles quand son contenu dépasse. Les tailles de texte du Profil (encart « En ce moment / Ce que je recherche » compris) s'alignent sur celles de la section IA, référence choisie par Julien, pour que toutes les sections aient des ordres de grandeur comparables. Les tests qui vérifiaient la réduction S sont rendus obsolètes par cette décision (D23, `Justification-test: F12-XP`, commit qui retire la réduction avec D42). |
| D42 | Tuiles repliées quand une tuile est agrandie (25 nov., lot F12) | Bureau : quand une tuile est agrandie, les tuiles secondaires autres qu'`experience.log` (`recommandations.md`, `ia.md`, ou le Profil) se replient en bas de la colonne et ne montrent que leur barre de titre (nom du fichier et bouton « agrandir ») ; `experience.log` prend la hauteur libérée et sa liste défile. Quand c'est `experience.log` qui est agrandie (précision du 25 nov., revue de la PR 20), le Profil prend sa place en haut de la colonne latérale, sur toute la hauteur libérée, et défile ; `recommandations.md` et `ia.md` se replient en dessous du Profil. Quand la zone est assez haute (3440 × 1440 notamment), la tuile partenaire reste empilée en entier sous la tuile agrandie, comme le prévoit le handoff, au lieu de se replier (choix de Julien du 25 nov.). Écart voulu au handoff (SPEC § 3 et 4). Mobile inchangé (une seule section à la fois). Tests rendus obsolètes : D23, `Justification-test: F12-XP`. |
| D43 | Contrôles de l'en-tête (25 nov., lot F12) | Ordre : sélecteur de langue à gauche, puis panneau d'accessibilité et interrupteur de thème côte à côte, dans toutes les barres (bureau, mobile, pages annexes). Dans « FR \| EN », les deux libellés ont la même largeur (le séparateur ne bouge plus au changement de langue) et la langue courante prend la couleur d'accent (contraste ≥ 4,5:1 dans les quatre palettes). Écart voulu au handoff. Tests rendus obsolètes : D23, `Justification-test: F12-ENTETE`. |
| D44 | Menu du CV (25 nov., lot F12, décision de Julien) | Le bouton « CV PDF » devient un menu déroulant qui propose toujours les deux versions : « Version française » et « Version anglaise » sur la page française, « French version » et « English version » sur la page anglaise. Chaque entrée mène au PDF de sa langue (`public/cv/cv-<langue>.pdf`, `hreflang`). Tant qu'un CV manque (liste relevée au build, `runtimeConfig.public.cvFiles`), son entrée reste affichée mais inactive (`aria-disabled`), avec la mention « (bientôt) » / « (coming soon) » ; elle redevient un lien dès que le fichier est ajouté. Remplace la mention de repli « (in French) » de D22 sur le bouton (et donc le débordement de la barre à 1024 px en anglais). Menu accessible au clavier (WCAG 2.2 AA : bouton `aria-expanded`, Échap, focus visible, cibles D17), aucun texte en dur. Tests rendus obsolètes : D23, `Justification-test: F12-CV`. |
| D45 | Tailles de texte d'Expérience (25 nov., lot F12) | Comme le Profil (D41), la section Expérience prend les tailles de la section IA, référence choisie par Julien : texte courant des cartes (`CardIntro`, `ExperienceCard`) en `--font-size-lead` sous 1024 px et `--font-size-body-mobile` au-delà ; petits textes (filtres, technos, tiroir, easter egg) en `--font-size-small` au lieu de `--font-size-meta` ; titre des cartes sur un token de taille au lieu de `1.25rem` écrit en dur. Tests rendus obsolètes : D23, `Justification-test: F12-XPTEXTE`. |
| D46 | Captures de référence du handoff (25 nov., lot F12) | Les captures du dossier `reference` du handoff v6 restent la copie du handoff, non régénérées. Elles ne correspondent plus au site pour les écarts voulus D41 à D45 (en-tête, Profil non réduit, tuiles repliées, menu du CV, tailles d'Expérience) : ces décisions font foi sur les captures. Aucun test ne les compare aujourd'hui ; une future régression visuelle prendra pour référence le site généré, pas ces captures. |
| D47 | Déclaration d'accessibilité et CV anglais (25 nov., lot F12) | La phrase de la déclaration sur le CV PDF (« rédigé en français, y compris depuis la version anglaise du site ») dépend des CV présents au build (`runtimeConfig.public.cvFiles`) : elle n'est affichée que tant que le CV anglais manque ; dès que `cv-en.pdf` est déposé, elle dit que le CV existe en français et en anglais. Le reste du constat (PDF non balisé, D33) est inchangé. Tests rendus obsolètes : D23, `Justification-test: F12-DECLA`. |
| D48 | Mosaïque avant le montage (26 nov., lot F11, F11-02) | Sur le bureau (≥ 1024 px), la page générée dessine déjà la mosaïque de la vue d'ensemble (tuiles avec leur barre de titre, colonnes et hauteurs de `computeLayout`) par CSS et requêtes média, au lieu d'une grille simple de 2 colonnes : le montage ne fait plus que poser les positions calculées, sans saut visible. Sans JavaScript, chaque tuile défile seule et les boutons « agrandir » restent sans effet. |
| D49 | Mesures du JS en CI (26 nov., lot F11, F11-06) | La CI échoue si un script du site généré (`_nuxt/*.js`) contient les schémas Zod ou les fixtures, et si le JS chargé par la page d'accueil (gzip) dépasse le budget : valeur mesurée à la fin du lot F11 plus 10 %. Les mesures (poids total, JS par page) sont affichées dans le résumé du job. |
| D20 | Prénom dans le contenu et les fixtures | Normal : c'est le CV de Julien ; seuls e-mail, téléphone et données de contact restent interdits dans le dépôt. |
| D18 | Nom accessible des fenêtres | Nom explicite (« Me contacter »…), le nom de fichier (`contact.sh`) reste le titre visible (F3). |

## Structure d'`apps/web`

```
apps/web/
  app/
    domain/          logique pure (aucun import Vue ni Nuxt) : filtre, mise en page des tuiles,
                     facteur S, préférences, formatage des dates et lieux
    data/            port CvSource, ApiCvSource (GET /cv), FixtureCvSource (fixtures validées par
                     les schémas de @siteperso/contracts), mapping contrat → modèles de vue
    components/base/ éléments de base (Button, TechChip, Accordion, Switch, Window, Popover, Tile…)
    components/<section>/   un dossier par section : profile, experience, recommendations, ai, shell
    composables/     pont entre domain et composants (état, URL, préférences)
    pages/           index, accessibilite, page 404
    assets/css/      tokens.css (du handoff), base, thèmes
  i18n/locales/      fr/ et en/ : common.json et un fichier par section (libellés d'interface ;
                     découpage décidé par Julien le 20 nov. 2026, posé en F0)
  public/            polices, CV PDF, favicon
  test/              e2e Playwright (*.e2e.ts), visuel, axe ; fixtures
```

Règle « modules isolés » transposée : un agent de section n'écrit que dans
`components/<section>/`, ses composables et ses tests. Fichiers partagés réservés au lead :
configuration Nuxt, `app.vue`, `assets/css/`, `components/base/` après le lot F1, i18n communs
(`common.json` ; chaque section a son fichier de libellés),
`data/`.

## Lots

```
F0 fondations ──┬── F1 design system ──┐
                ├── F2 logique pure ───┼── F3 coquille ──┐
                │                      │                 ├── F5 sections (A ∥ B) ── F6 mosaïque ── F7 annexes ── F8 QA ── F10 revues
[back : BF contrats] ──── F4 données ──┴─────────────────┘                                                      F9 déploiement ┘
```

Bloquants back : **F4 attend le lot contrats du brief back-001** ; F9 attend le brief back-005
(service du front dans la pile). F0 à F3 ne dépendent pas du back.

### F0 Fondations front (lead-architecte, Opus)
- F0-01 `apps/web` Nuxt (D1), TypeScript strict, ESM, `@siteperso/contracts` en dépendance.
- F0-02 ESLint (Vue), Prettier, scripts `lint`, `typecheck`, `test`, `test:e2e`, `build` branchés dans Turborepo et `pnpm check`.
- F0-03 Vitest (unitaires + composants, `@nuxt/test-utils`, `@vue/test-utils`), couverture 100 % fusionnée (D3), Stryker sur `domain/` et `data/`.
- F0-04 Playwright + axe, projets par taille d'écran (390, 834, 1024, 1280, 1440, 1920, 3440).
- F0-05 i18n FR/EN, URLs `/en/...`, sélecteur de langue.
- F0-06 Garde-fous : hooks et `check-tests-integrity.sh` étendus aux tests d'`apps/web` ; CI : job front.
- F0-07 Les trois nouveaux agents (voir plus bas) et la mise à jour des agents existants.
- F0-08 `CLAUDE.md` : section front (structure, règles, commandes) ; handoff versionné (D7).

### F1 Design system (dev-front)
- F1-01 `tokens.css`, base en `rem`, thèmes sombre et clair, palette contraste renforcé, focus visible.
- F1-02 Polices auto-hébergées (D6), police lisible chargée seulement à l'activation.
- F1-03 Éléments de base : Button et LinkButton (5 variantes), TechChip, SeniorBadge, Accordion, Switch, SegmentedControl.
- F1-04 Window (modale : piège de focus, Échap, voile, retour du focus) et Popover (non modal).
- F1-05 Tile (barre de titre `>_ fichier`, agrandir/réduire, `inert` quand sortie).
- F1-06 `prefers-reduced-motion` et réglage « réduire les animations » sur tous les éléments.

### F2 Logique pure (dev-front, en parallèle de F1)
- F2-01 `filter` : ET strict, mots-clés cachés, compteurs dynamiques, désactivation à 0, suggestions (6), groupes de résultats.
- F2-02 `layout` : mosaïque 2 et 3 colonnes, tuile agrandie, colonne latérale (≥ 340 px), empilement Profil + IA, poussée hors zone, plafond 1440 px.
- F2-03 `fit` : facteur S par dichotomie avec fonction de mesure injectée, bornes 0,6–1, cache par (largeur, hauteur).
- F2-04 `preferences` : thème, taille du texte, interrupteurs ; lecture système et localStorage (erreurs tolérées).
- F2-05 Formatage : période, ligne lieu · mode · contrat, dates des recommandations (fr, en).

### F3 Coquille et navigation (dev-front)
- F3-01 AppShell, lien d'évitement, application des préférences sans flash (D5).
- F3-02 TopBar desktop, MobileHeader, BottomNav (glissement entre sections), ActionBar masquable (seuil 24 px, verrou 360 ms), ScrollHint.
- F3-03 Points de rupture (< 768, 768–1023, 1024–1199, ≥ 1200) et vues mobile/tablette par onglets.
- F3-04 Panneau d'accessibilité (6 réglages, Réinitialiser, lien vers la déclaration).
- F3-05 Boutons Lancer l'entretien (`mailto:`, adresse en configuration) et CV PDF.

### F4 Données (dev-front, après le lot contrats du back)
- F4-01 Port `CvSource`, `ApiCvSource` (`GET /cv?lang=`), `FixtureCvSource`.
- F4-02 Fixtures FR/EN tirées du handoff, validées par les schémas des contrats.
- F4-03 Mapping contrat → modèles de vue (`docs/04`).
- F4-04 Génération statique : lecture de l'API au build, échec explicite si l'API ne répond pas ; source choisie par variable d'environnement.

### F5 Sections (deux dev-front en parallèle)
- **F5-A** Profil (titre, pastille, accroches, encadré situation, liens, `FitToHeight`), IA, Recommandations (lien source, citations avec `lang`, état vide si aucune publiée).
- **F5-B** XP : TechFilter (champ à puces, panneau, suggestions, clavier, `aria-live`), cartes en accordéon, groupes de résultats, filtres dans l'URL (`?tech=`), easter egg (« Huile de coude »).

### F6 Mosaïque (dev-front, effort high)
- F6-01 TileGrid branché sur `layout` : agrandir, vue d'ensemble, onglets de la barre du haut.
- F6-02 Animations (550 ms, `visibility` différée), mesures sur clone (`ResizeObserver`, `document.fonts.ready`), aucun recalcul visible.
- F6-03 Profil réduit ou défilant selon le cas (§ 4.1 de la spec), désactivé quand le texte est agrandi.

### F7 Pages annexes et états (dev-front)
- F7-01 Déclaration d'accessibilité (contenu provisoire marqué), page 404, page d'erreur.
- F7-02 Version anglaise complète de l'interface ; contenus EN servis par l'API.
- F7-03 SEO de base : titres, description, `lang`, `hreflang`, plan du site.

### F8 QA front (qa-front)
- F8-01 Parcours Playwright : filtre avec URL, agrandir puis réduire, thème, panneau au clavier, onglets mobile, easter egg.
- F8-02 Matrice taille × thème × langue avec axe ; contraste renforcé.
- F8-03 Régression visuelle contre les captures du handoff. Décision de Julien du 20 nov. 2026 :
  pas de tolérance en F0, on vise une V1 d'abord ; les captures de référence restent protégées
  (oracles des garde-fous depuis F0), la comparaison et sa tolérance sont posées en F8.
- F8-04 Tests en échec attendu pour chaque défaut trouvé.

### F9 Déploiement (dev-devops, après le brief back-005)
- F9-01 Build statique dans l'image, service par Caddy, CSP stricte (empreinte du script de thème), HSTS, en-têtes.
- F9-02 Pile locale complète front + API + Caddy, e2e Playwright contre elle, job CI.
- F9-03 (décidé le 20 nov.) CSP : empreinte du script de thème (`THEME_SCRIPT_SHA256`, F3a), empreintes des scripts en ligne de Nuxt (`importmap`, `window.__NUXT__`) recalculées à chaque génération, `<style>` en ligne ; Caddy : vraie redirection 301 de `/fr` et `/fr/*` vers le chemin sans préfixe (aujourd'hui une page `meta refresh`).

### F11 Optimisation (décidé le 20 nov., en fin de chantier)
- F11-01 Poids du JavaScript client : fixtures et Zod ne servent qu'au build et ne doivent pas partir dans le navigateur (473 ko de JS au total relevés en F3a).
- F11-02 Saut à l'hydratation : mosaïque dessinée avant le montage (D48).
- F11-03 Assistants communs des parcours Playwright (`test/support/`, RC-7 de la revue F10) : module du lead, migration des parcours par le correcteur.
- F11-04 Nom SEO depuis le contrat (RC-5 de la revue F10) : nom affiché dans `ProfileView`, description SEO paramétrée.
- F11-05 `csp.e2e.ts` importe `buildPolicy` de `scripts/deploy/csp-hashes.mjs` (D40), après BF-17.
- F11-06 Mesures du JS en CI (D49).

### F10 Revues et recette (revue-code, revue-securite, revue-a11y, triage, correcteur, chef-de-projet)
- Revues indépendantes, triage, corrections, recette finale depuis un clone neuf.

## Agents

Existants, utilisés tels quels : **chef-de-projet**, **triage**, **correcteur**.
Existants, à étendre au front en F0-07 (une section « front » dans leur fichier) :

| Agent | Ajout |
|---|---|
| lead-architecte | `apps/web` et ses fichiers partagés dans son périmètre |
| dev-devops | build statique du front, Caddy, CSP |
| revue-code | grille Vue/Nuxt : réactivité, fuites d'écouteurs, `v-html` interdit, logique dans `domain/` |
| revue-securite | CSP, dépendances front, liens externes, absence de données personnelles dans le bundle |

Nouveaux :

| Agent | Mission | Écrit | Modèle, effort |
|---|---|---|---|
| **dev-front** | Un élément de base, une section ou un service : composants Vue accessibles, logique pure dans `domain/`, tests unitaires et de composants à 100 %, règle « modules isolés » | ses dossiers | Sonnet, high |
| **qa-front** | Parcours Playwright, matrice taille × thème × langue, axe, régression visuelle, tests en échec attendu des défauts | tests seulement | Sonnet, medium |
| **revue-a11y** | Audit WCAG 2.2 AA / RGAA adversarial en lecture seule : clavier, lecteur d'écran (arbre d'accessibilité), contrastes calculés depuis les tokens, mouvement, zoom 200 %, chaque finding constaté par une commande | `docs/revues/a11y-<date>.md` | Opus, high |

## Coordination avec la session back

But : deux sessions qui ne s'attendent presque jamais et ne se marchent pas dessus.

1. **Territoires.** La session front écrit dans `apps/web/`, `docs/0[4-5]-front-*`, `docs/briefs/`
   et ses comptes rendus. La session back écrit dans `apps/api/`, `db/`, `packages/contracts/`.
   Les fichiers racine partagés (`package.json`, `turbo.json`, CI, hooks, `CLAUDE.md`) ne sont
   touchés par le front qu'en F0, en commits `chore:` dédiés ; la session back évite d'y toucher
   pendant F0.
2. **Demandes par fichiers, jamais modifiés.** Chaque besoin du front est un nouveau brief
   `docs/briefs/back-NNN-sujet.md` avec des tickets `BF-n`. Un brief publié ne se modifie pas :
   une correction est un nouveau brief. Aucun fichier d'état partagé, donc aucun conflit.
3. **Suivi par git.** La session back cite le ticket dans ses commits ; la session front suit avec
   `git log develop --grep BF-`. Les écarts (nom de champ différent…) sont dans le compte rendu du
   lot back.
4. **Le contrat d'abord.** Le back fusionne les schémas Zod et l'OpenAPI avant les migrations ; le
   front travaille sur des fixtures validées par ces schémas, puis bascule sur l'API réelle par une
   variable d'environnement. Si le contrat réel diffère, les fixtures ne valident plus : l'écart se
   voit au test, pas en production.
5. **Pas d'attente.** Tant qu'un BF n'est pas livré, le front avance sur les lots qui n'en
   dépendent pas (F0 à F3 d'abord). Ordre de lancement conseillé côté back : le lot contrats du
   brief back-001 tout de suite.
6. **Branche commune `develop`.** Chaque session fusionne ses lots elle-même, après avoir intégré
   `develop` dans sa branche de lot et relancé `pnpm check`. La session front ne pousse jamais :
   le push de `develop` reste à la session back (ou à Julien).
7. **Docker.** Chaque worktree a ses ports (`.env` racine) ; la session front prend la plage
   58xx pour ne pas croiser les lots back.
8. **Arbitrage.** Un désaccord entre les deux sessions remonte à Julien ; aucune session ne modifie
   le territoire de l'autre pour se débloquer.
