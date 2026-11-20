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

Bloquants back : **F4 attend le lot contrats du brief back-001** ; F9 attend le brief back-002
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

### F9 Déploiement (dev-devops, après le brief back-002)
- F9-01 Build statique dans l'image, service par Caddy, CSP stricte (empreinte du script de thème), HSTS, en-têtes.
- F9-02 Pile locale complète front + API + Caddy, e2e Playwright contre elle, job CI.

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
