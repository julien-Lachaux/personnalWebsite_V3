# Lot F11 : optimisation du front, synthèse de l'orchestration

Date : 26 nov. 2026. Branche `lot/F11-optimisation`, partie de `develop` (`567527c`), mise à jour par
fusion de `origin/develop` (`2521291` : BF-17, lots 35 et 36). Rien n'est poussé ; la session principale
ouvre la pull request vers `develop`, et sa CI sera l'unique vérification complète du lot (D26).

Comptes rendus détaillés : `lot-F11-lead.md` (F11-01, F11-02, F11-04, F11-03 partie lead, polices),
`lot-F11-correcteur.md` (RC-5, RC-7, D51-4, RC-8), `lot-F11-devops.md` (F11-06).

## Tickets

| Ticket | État | Commits principaux | Rôle |
|---|---|---|---|
| F11-01 Poids du JS client | fait | `b64acd4`, `8495e07`, `9d2548d` | lead-architecte |
| F11-02 Saut à l'hydratation (D49) | fait | `dcbb7fd`, `53b2e9d`, `8496929` | lead-architecte |
| F11-02 suite : polices de repli au bureau (D51 (4)) | fait | `3a17bee`, `405c62f`, `190ad43` | lead-architecte, correcteur |
| F11-03 Assistants communs des parcours (RC-7) | fait | `e6f49e5`, `cd46226` (module) ; `90759f0` à `35fdb37` (migration) | lead-architecte puis correcteur |
| F11-04 Nom SEO depuis le contrat (RC-5) | fait | `6eed6cb`, `3820f7a`, `88615a9`, `21e871c` | lead-architecte puis correcteur |
| F11-05 CSP des parcours importée du déploiement (D40, RC-8) | fait | `df6e603` | correcteur |
| F11-06 Mesures du JS en CI (D50) | fait, mesure réelle au premier run de la CI | `9b266b0`, `00e50b0` | dev-devops |

Le test instable `chip-pressed-mark.e2e.ts:93` (rattaché à F11-02) était déjà corrigé par le lot 28
(`ce9fafe`) : rien refait.

## Mesures avant / après

Build `generate:fixtures`, gzip -9.

| Mesure | Avant (`567527c`) | Après |
|---|---|---|
| JS publié (`_nuxt/*.js`) | 533 741 o / 175 029 o gzip | 395 987 o / 140 915 o gzip (−26 %) |
| Morceau source du CV (Zod + fixtures) | 138 603 o, publié même sur la source `api` | absent (module de remplacement de 316 o) |
| JS chargé par `/` | 389 580 o / 137 762 o gzip | 390 965 o / 138 460 o gzip |
| Budget CI (D50) | — | 152 306 o gzip (138 460 + 10 %) |

CLS sous processeur ×6 et réseau lent (sondes jetables, 3 passes) :

| Largeur | Avant | Après F11-02 | Après polices (fin de lot) |
|---|---|---|---|
| 390 | 0,0213 | 0,0227 | 0,0227 |
| 1024 | 0,0033 | 0,0182 | 0,0004 |
| 1280 | 0,0068 | 0,0547 | 0,006 |
| 1920 | 0,0249 | 0,0184 | 0,0029 |

Le chiffre « avant » sous-estimait le saut : des nœuds remplacés au montage (ancienne grille) ne comptent
pas dans le CLS. Après F11-02, aucun décalage n'est enregistré au montage ; ce qui restait venait de
l'arrivée des polices, traité par les polices de repli ajustées au bureau.

## Décisions de Julien (docs/05)

- D49 : mosaïque dessinée dès la page générée.
- D50 : garde-fous Zod et fixtures, et budget du JS de l'accueil + 10 % en CI.
- D51 : (1) la page « travaux » garde le nom en dur ; (2) axe strict sur `pages`, `work-in-progress` et
  `hydration-shift` ; (3) écart de 2,2 px du Profil au montage en 3 colonnes accepté ; (4) polices de repli
  ajustées, au bureau seulement (le préchargement était sans effet).
- Numéros : D48 était pris par le lot 35 ; les décisions du lot sont renumérotées D49 à D51 (`6510b49`).
- Décision technique de l'orchestrateur : la requête média du bureau entre dans la table `MEDIA` de
  `control-tokens.spec.ts` (`405c62f`) plutôt que de poser la règle dans un fichier que ce test ne lit pas.

## Incidents

- Crash de la machine (vers 15 h 57) : F11-02 repris sans conteneurs, puis Podman rendu par le lot 35.
- Autorisations créées sans `CLAUDE_PROJECT_DIR` : écrites dans le checkout principal, invisibles du
  worktree ; recréées dans l'état du worktree. Toutes les autorisations du lot sont révoquées.
- Garde-fous : exécuter `scripts/ci/front-bundle-budget.mjs` est refusé (écriture opaque mentionnant
  l'oracle des fixtures), y compris à la session principale ; son test passe par `pnpm integrity:test`.
  Une proposition de contournement par un script `pnpm` a été refusée par le classifieur et abandonnée.
- `pnpm db:down` lancé par le correcteur de F11-05 (test e2e de l'API) a aussi arrêté le conteneur
  Playwright. Fin de lot : aucun conteneur du projet `siteperso-v3-f11`.
- Agents lancés dans herdr à la demande de Julien à partir des polices au bureau (`hc run … claude --agent
  <rôle>`), rôle reconnu par les garde-fous (vérifié par une sonde).

## Vérifications ciblées (D26)

Couverture du front 100 % à chaque étape (1 228 tests en fin de polices), mutation des fichiers touchés de
`app/data` et `app/domain` (36/36, 160/160), parcours Playwright touchés avec `--workers=2` (dont 2 429 tests
migrés en F11-03, 322 en F11-05, 910 pour les polices), `pnpm integrity:test`, lint des workflows et des
scripts, `pnpm integrity develop` OK en fin de lot.

## Points ouverts

- Premier run de la CI : vérifier que le résumé de l'étape « Mesures et budget du JavaScript » donne
  environ 138 460 o pour `/` (mesure réelle jamais lancée en local, garde-fous).
- Exécution locale du script de budget : à autoriser explicitement dans les garde-fous si Julien le veut.
- Polices : Atkinson Hyperlegible sans repli ajusté ; Android, Windows et macOS non mesurés (le conteneur
  n'a que Liberation Sans et Liberation Mono).
- Compilateur de messages de vue-i18n gardé (le retirer casse l'affichage) ; pistes non faites :
  `i18n.bundle.fullInstall: false`, panneau d'accessibilité chargé à l'ouverture (décision d'affichage).
- Décalage mobile `action-bar` / `cv-menu` (0,018 à 390 px, avant le montage), antérieur au lot.
- Hors F11 : RC-9 (`waitForTimeout(400)` de `cv.e2e.ts:73`, délais fixes) et RC-10 (commentaire périmé de
  `sections.e2e.ts`).
- La commande `pnpm --filter @siteperso/web test:e2e -- <args>` ignore ses arguments : les agents utilisent
  `pnpm exec playwright test --workers=2 <fichiers>` dans `apps/web`.
